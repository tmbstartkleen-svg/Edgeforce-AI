type Listing = { id: string; name: string; group: string; url: string; lookupKey?: string };
type Source = { provider: string; checkedAt: string; entries: Listing[]; error: string | null };
let cache: { until: number; value: Source[] } | undefined;
let pending: Promise<Source[]> | undefined;
async function catalog(provider: string, url: string): Promise<Source> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    const body = await response.json();
    const rows = provider === 'Kalshi' ? body.series : body;
    if (!Array.isArray(rows)) throw new Error('Source format unavailable');
    const entries: Listing[] = rows.map((row) => provider === 'Kalshi' ? {
      id: String(row.ticker), name: String(row.title),
      group: Array.isArray(row.tags) ? row.tags.join(' / ') : 'Sports',
      url: 'https://kalshi.com/category/sports/all-sports',
    } : {
      id: String(row.id), name: String(row.name || row.sport),
      lookupKey: row.primaryTagId ? String(row.primaryTagId) : undefined,
      group: String(row.sport),
      url: `https://polymarket.com/sports/${encodeURIComponent(row.sport)}/games`,
    });
    return { provider, checkedAt, entries, error: null };
  } catch (error) {
    return { provider, checkedAt, entries: [], error: error instanceof Error ? error.message : 'Source unavailable' };
  }
}
export async function getCoverage() {
  if (cache && cache.until > Date.now()) return cache.value;
  if (!pending) pending = Promise.all([
    catalog('Kalshi', 'https://external-api.kalshi.com/trade-api/v2/series?category=Sports'),
    catalog('Polymarket', 'https://gamma-api.polymarket.com/sports'),
  ]).then((value) => {
    cache = { value, until: Date.now() + (value.some((source) => source.error) ? 30000 : 15 * 60 * 1000) };
    return value;
  }).finally(() => { pending = undefined; });
  return pending;
}

type MarketView = { id: string; title: string; prices: string; rules: string; updatedAt: string | null };
type EventView = { id: string; title: string; state: string; startsAt: string | null; url: string; markets: MarketView[] };
export type EventPage = { checkedAt: string; events: EventView[]; nextCursor: string | null; more: boolean; error: string | null };
const eventCache = new Map<string, { until: number; value: EventPage }>();
const eventPending = new Map<string, Promise<EventPage>>();
function validDate(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}
function cents(value: unknown): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') return 'unavailable';
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? `${(n * 100).toFixed(1)}¢` : 'unavailable';
}
function arrayValue(value: unknown): unknown[] {
  try { const parsed = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
export async function getCoverageEvents(provider: string, id: string, cursor = ''): Promise<EventPage> {
  const empty = (error: string): EventPage => ({ checkedAt: new Date().toISOString(), events: [], nextCursor: null, more: false, error });
  if (!['Kalshi', 'Polymarket'].includes(provider) || !id || id.length > 200 || cursor.length > 4096) return empty('Invalid event request.');
  const sources = await getCoverage();
  const source = sources.find((item) => item.provider === provider);
  if (source?.error) return empty(`${provider} catalog unavailable: ${source.error}`);
  const listing = source?.entries.find((entry) => entry.id === id);
  if (!listing) return empty('Choose an available catalog entry.');
  const key = `${provider}:${id}:${cursor}`;
  const cached = eventCache.get(key);
  if (cached && cached.until > Date.now()) return cached.value;
  const existing = eventPending.get(key);
  if (existing) return existing;
  const task = (async () => {
    try {
      let url = provider === 'Kalshi'
        ? `https://external-api.kalshi.com/trade-api/v2/events?status=open&limit=100&with_nested_markets=true&series_ticker=${encodeURIComponent(id)}`
        : `https://gamma-api.polymarket.com/events/keyset?closed=false&limit=100&tag_id=${encodeURIComponent(listing.lookupKey || '')}`;
      if (provider === 'Polymarket' && !listing.lookupKey) return empty('This competition has no event lookup identifier.');
      if (cursor) url += `&${provider === 'Kalshi' ? 'cursor' : 'after_cursor'}=${encodeURIComponent(cursor)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
      const body = await response.json();
      const raw = body.events;
      if (!Array.isArray(raw)) throw new Error('Event response unavailable');
      const seen = new Set<string>();
      const events: EventView[] = raw.filter((event) => {
        if (!event || typeof event !== 'object' || event.closed === true || event.archived === true) return false;
        const id = event.event_ticker || event.id;
        if (!['string', 'number'].includes(typeof id) || !String(id) || seen.has(String(id))) return false;
        seen.add(String(id));
        return true;
      }).map((event) => {
        const markets = (Array.isArray(event.markets) ? event.markets : []).filter((market: Record<string, unknown> | null) => market && (provider === 'Kalshi' ? market.status === 'active' : market.active === true && market.closed !== true && market.archived !== true)).map((market: Record<string, unknown>) => {
          const outcomes = arrayValue(market.outcomes), prices = arrayValue(market.outcomePrices);
          return {
            id: String(market.ticker || market.id), title: String(market.title || market.question || 'Market'),
            prices: provider === 'Kalshi'
              ? `Yes bid ${cents(market.yes_bid_dollars)} / ask ${cents(market.yes_ask_dollars)} · No bid ${cents(market.no_bid_dollars)} / ask ${cents(market.no_ask_dollars)}`
              : outcomes.map((outcome, index) => `${String(outcome)} ${cents(prices[index])}`).join(' · ') || 'Prices unavailable',
            rules: String(market.rules_primary || market.description || '') + (market.rules_secondary ? `\n${market.rules_secondary}` : ''),
            updatedAt: validDate(market.updated_time || market.updatedAt),
          };
        });
        const startsAt = provider === 'Polymarket' ? validDate(event.startTime) : null;
        const state = provider === 'Kalshi' ? 'Open contract · game status unverified'
          : event.ended === true ? 'Ended · settlement pending'
          : event.live === true ? 'Provider reports live'
          : startsAt && Date.parse(startsAt) > Date.now() ? 'Scheduled'
          : event.gameId ? 'Game status unverified' : 'Future / other event';
        return {
          id: String(event.event_ticker || event.id), title: String(event.title || 'Event'), state, startsAt, markets,
          url: provider === 'Kalshi' ? 'https://kalshi.com/category/sports/all-sports' : `https://polymarket.com/event/${encodeURIComponent(typeof event.slug === 'string' ? event.slug : '')}`,
        };
      });
      const token = provider === 'Kalshi' ? body.cursor : body.next_cursor;
      const nextCursor = typeof token === 'string' && token && token !== cursor ? token : null;
      const value: EventPage = { checkedAt: new Date().toISOString(), events, nextCursor, more: Boolean(nextCursor), error: null };
      if (eventCache.size >= 100) eventCache.delete(eventCache.keys().next().value!);
      eventCache.set(key, { value, until: Date.now() + 60000 });
      return value;
    } catch (error) { return empty(error instanceof Error ? error.message : 'Events unavailable'); }
  })();
  eventPending.set(key, task);
  try { return await task; } finally { eventPending.delete(key); }
}
