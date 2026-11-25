import type {ProviderConfig} from './types';

const MAX_ROWS = 4000;
const MAX_DISPLAY = 100;
const MAX_TRACKED_GROUPS = 24_000;
const MAX_AGE_MS = 5 * 60_000;
const MAX_SOURCE_SKEW_MS = 2 * 60_000;
const genericSlots = new Set(['odds-provider-primary', 'odds-provider-secondary', 'odds-provider-tertiary']);
const sportsbookNames = new Map([
 ['draftkings', 'DraftKings'], ['fanduel', 'FanDuel'], ['betmgm', 'BetMGM'],
 ['caesars', 'Caesars'], ['bet365', 'bet365'], ['fanatics', 'Fanatics'], ['pinnacle', 'Pinnacle']
]);
const zonedIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const text = (value: unknown) => typeof value === 'string' && value.length <= 150 && !/[\x00-\x1f\x7f]/.test(value)
 ? value.trim().replace(/\s+/g, ' ') : '';
const key = (value: unknown) => text(value).normalize('NFC').toLowerCase();
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
 ? value as Record<string, unknown> : {};
const timestamp = (value: unknown) => {
 if (typeof value !== 'string' || !zonedIso.test(value)) return NaN;
 const wallTime = value.slice(0, 19);
 const calendar = new Date(wallTime + 'Z');
 if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 19) !== wallTime) return NaN;
 return Date.parse(value);
};
const identifier = (value: unknown) => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{1,63}$/.test(value) ? value : '';
const append = <T>(map: Map<string,T[]>, id: string, value: T) => {
 const entries = map.get(id);
 if (entries) entries.push(value);
 else map.set(id, [value]);
};
const count = (counts: Record<string,number>, reason: string) => { counts[reason] = (counts[reason] || 0) + 1; };

export const isGenericOddsSlot = (config: ProviderConfig) => genericSlots.has(config.id);

export function isPriceReviewSlot(config: ProviderConfig, approvals = process.env.ODDS_PRICE_REVIEW_APPROVALS) {
 return approvals !== undefined && isGenericOddsSlot(config);
}

type PilotScope = {sport: string; league: string};
export type PriceReviewApproval = {operator: string; host: string; books: Set<string>; maxAgeMs: number; pilotScope?: PilotScope};

// Only administrator-configured generic connections participate. Feed data cannot declare
// its own permissions, bookmaker list, operator or transport identity.
export function priceReviewApproval(config: ProviderConfig, json = process.env.ODDS_PRICE_REVIEW_APPROVALS): PriceReviewApproval | undefined {
 if (!isPriceReviewSlot(config, json) || !json || json.length > 8192) return;
 try {
  const target = new URL(config.url);
  const catalog = record(JSON.parse(json));
  const entry = record(catalog[config.id]);
  const scope = record(catalog.pilotScope);
  const sport = key(scope.sport), league = key(scope.league);
  if (Object.hasOwn(catalog, 'pilotScope') && (!sport || !league)) return;
  const operator = identifier(entry.operator);
  if (target.protocol !== 'https:' || target.username || target.password || target.port ||
   target.origin !== entry.origin || !operator || !Array.isArray(entry.books) || !entry.books.length ||
   !entry.books.every(book => typeof book === 'string' && sportsbookNames.has(book)) ||
   !Number.isFinite(config.maxAgeMin) || config.maxAgeMin <= 0) return;
  return {operator, host: target.hostname, books: new Set(entry.books),
   maxAgeMs: Math.min(MAX_AGE_MS, config.maxAgeMin * 60_000), ...(sport && league ? {pilotScope: {sport, league}} : {})};
 } catch { return; }
}

type MarketIdentity = {
 sport: string; league: string; home: string; away: string; startTime: string;
 market: 'moneyline'|'spread'|'total'; settlementKey: string; line: number|null; currency: 'USD';
};
type Quote = {selection: string; americanOdds: number};
type BookMarket = {
 identity: MarketIdentity; groupKey: string; marketKey: string; providerId: string; bookId: string; sourceEventId: string;
 operator: string; host: string; sourceUpdatedAt: string; expiresAt: string; quotes: Quote[];
};
type BookRevision = {at: number; state: 'WITHHELD'|'CONFLICT'} | {at: number; state: 'OPEN'; fingerprint: string};
export type PriceReviewSource = {
 rowsExamined: number; eligibleMarkets: BookMarket[]; revisions: Map<string,BookRevision>;
 rejections: Record<string,number>; truncated: boolean;
};
export const validPriceReviewResponse = (source: PriceReviewSource) =>
 !source.truncated && !source.rejections.INVALID_FEED_CONTRACT;
export type PriceReviewSnapshot = {read(now?: number): PriceReview};
export type PriceReviewStatus = 'NO_APPROVED_FEEDS'|'APPROVED_FEEDS_UNAVAILABLE'|'NO_ELIGIBLE_MARKETS'|'NO_INDEPENDENT_MATCH'|'CORROBORATED';
type ReviewedMarket = MarketIdentity & {
 id: string; expiresAt: string; sources: {
  bookmaker: string; providerId: string; sourceEventId: string;
  sourceUpdatedAt: string; expiresAt: string; quotes: Quote[];
 }[];
};
export type PriceReview = {
 schema: 'edgeforce-sportsbook-price-review-v1';
 status: PriceReviewStatus; approvedFeeds: number; respondedFeeds: number; rowsExamined: number;
 eligibleBookMarkets: number; corroboratedMarkets: number; omittedMarkets: number; inputTruncated: boolean;
 rejections: Record<string,number>; markets: ReviewedMarket[];
 recommendationsAuthorized: false;
};

function marketIdentity(row: Record<string,unknown>) {
 const sport = key(row.sport), league = key(row.league), home = key(row.home), away = key(row.away);
 const start = timestamp(row.startTime), settlementKey = identifier(row.settlementKey);
 const market = row.market;
 if (!sport || !league || !home || !away || home === away || !Number.isFinite(start) ||
  !settlementKey || row.period !== 'FULL_GAME' || row.currency !== 'USD' ||
  !(market === 'moneyline' || market === 'spread' || market === 'total')) return;
 const line = market === 'moneyline' ? null : row.line;
 if (market === 'moneyline' ? row.line !== undefined && row.line !== null :
  typeof line !== 'number' || !Number.isSafeInteger(line * 2) || Math.abs(line) > 1000 ||
  (market === 'total' && line <= 0)) return;
 const identity: MarketIdentity = {sport: text(row.sport), league: text(row.league), home: text(row.home), away: text(row.away),
  startTime: new Date(start).toISOString(), market: market as MarketIdentity['market'], settlementKey, line: line as number|null, currency: 'USD'};
 return {identity, identityKey: JSON.stringify([sport, league, home, away, identity.startTime, market, settlementKey, line, row.currency]), start};
}

function allowedSelections(market: MarketIdentity, outcomeCount: unknown) {
 if (market.market === 'total') return outcomeCount === 2 ? ['over','under'] : [];
 const teams = [key(market.home), key(market.away)];
 if (outcomeCount === 2) return teams;
 if (outcomeCount === 3 && market.market === 'moneyline' && !teams.includes('draw')) return [...teams, 'draw'];
 return [];
}

export function normalizePriceReviewSource(payload: unknown, providerId: string, approval: PriceReviewApproval,
 now = Date.now()): PriceReviewSource {
 const rows = Array.isArray(payload) ? payload : record(payload).markets;
 const result: PriceReviewSource = {rowsExamined: 0, eligibleMarkets: [], revisions: new Map(), rejections: {}, truncated: false};
 if (!Array.isArray(rows)) {
  count(result.rejections, 'INVALID_FEED_CONTRACT');
  return result;
 }
 // The cutoff can split a market or omit a newer revision. Fail closed for that feed.
 if (rows.length > MAX_ROWS) {
  result.truncated = true;
  count(result.rejections, 'FEED_ROW_LIMIT');
  return result;
 }
 type Revision = {row: Record<string,unknown>; at: number; sourceEventId: string};
 type Group = {identity: MarketIdentity; identityKey: string; start: number; bookId: string; revisions: Revision[]};
 const groups = new Map<string,Group>();
 const idsByFixture = new Map<string, Set<string>>();
 const fixturesById = new Map<string, Set<string>>();
 for (const value of rows) {
  result.rowsExamined++;
  const row = record(value);
  if (row.evidenceClass === 'OBSERVED_REFERENCE' || row.liveEligible === false || row.venueType !== 'SPORTSBOOK') {
   count(result.rejections, 'REFERENCE_DELAYED_OR_UNSUPPORTED_VENUE'); continue;
  }
  const bookId = key(row.bookmaker);
  if (!approval.books.has(bookId)) {
   count(result.rejections, 'BOOKMAKER_NOT_APPROVED'); continue;
  }
  if (approval.pilotScope && (key(row.sport) !== approval.pilotScope.sport || key(row.league) !== approval.pilotScope.league)) {
   count(result.rejections, 'OUTSIDE_PILOT_SCOPE'); continue;
  }
  const axis = marketIdentity(row), sourceEventId = text(row.sourceEventId);
  if (!axis || !sourceEventId) {
   count(result.rejections, 'INVALID_EVENT_OR_MARKET_IDENTITY'); continue;
  }
  const fixture = JSON.stringify([key(row.sport), key(row.league), key(row.home), key(row.away), axis.identity.startTime]);
  if (!idsByFixture.has(fixture)) idsByFixture.set(fixture, new Set());
  idsByFixture.get(fixture)!.add(sourceEventId);
  if (!fixturesById.has(sourceEventId)) fixturesById.set(sourceEventId, new Set());
  fixturesById.get(sourceEventId)!.add(fixture);
  const groupKey = JSON.stringify([axis.identityKey, bookId]);
  const group = groups.get(groupKey) ?? {...axis, bookId, revisions: []};
  group.revisions.push({row, at: timestamp(row.sourceTimestamp), sourceEventId});
  groups.set(groupKey, group);
 }
 for (const [groupKey, {identity, identityKey, start, bookId, revisions}] of groups) {
  const withhold = (reason: string, at: number) => {
   count(result.rejections, reason);
   result.revisions.set(groupKey, {at, state: 'WITHHELD'});
  };
  const fixture = JSON.stringify([key(identity.sport), key(identity.league), key(identity.home), key(identity.away), identity.startTime]);
  if (idsByFixture.get(fixture)!.size !== 1 || revisions.some(revision => fixturesById.get(revision.sourceEventId)!.size !== 1)) {
   withhold('AMBIGUOUS_PROVIDER_EVENT', now); continue;
  }
  // Resolve the current revision before validation. A closure, invalid timestamp, or
  // incomplete latest market cannot revive a formerly available price.
  if (revisions.some(({at}) => !Number.isFinite(at) || at > now)) {
   withhold('UNVERIFIED_BOOK_UPDATE_TIME', now); continue;
  }
  const latest = Math.max(...revisions.map(({at}) => at));
  const expires = Math.min(latest + approval.maxAgeMs, start);
  if (start <= now || latest + MAX_AGE_MS <= now) {
   count(result.rejections, start <= now ? 'EVENT_STARTED' : 'BOOK_UPDATE_EXPIRED'); continue;
  }
  const current = revisions.filter(({at}) => at === latest);
  if (current.some(({row}) => row.status !== 'OPEN')) {
   withhold('MARKET_NOT_OPEN', latest); continue;
  }
  const selections = allowedSelections(identity, current[0].row.outcomeCount);
  const prices = new Map<string,Quote>();
  let invalid = !selections.length;
  for (const {row} of current) {
   const side = key(row.selection), odds = row.odds;
   if (row.outcomeCount !== selections.length || !selections.includes(side) ||
    typeof odds !== 'number' || !Number.isSafeInteger(odds) || Math.abs(odds) < 100 ||
    (prices.has(side) && prices.get(side)!.americanOdds !== odds)) {
    invalid = true; break;
   }
   prices.set(side, {selection: text(row.selection), americanOdds: odds});
  }
  if (invalid || prices.size !== selections.length) {
   withhold('INCOMPLETE_OR_CONFLICTING_OUTCOMES', latest); continue;
  }
  selections.sort();
  const market = {identity, groupKey, marketKey: JSON.stringify([identityKey, selections]),
   providerId, bookId, sourceEventId: current[0].sourceEventId, operator: approval.operator, host: approval.host,
   sourceUpdatedAt: new Date(latest).toISOString(), expiresAt: new Date(expires).toISOString(),
   quotes: selections.map(selection => prices.get(selection)!)};
  result.revisions.set(groupKey, {at: latest, state: 'OPEN', fingerprint: quoteFingerprint(market)});
  if (now >= expires) {
   count(result.rejections, 'BOOK_UPDATE_EXPIRED'); continue;
  }
  result.eligibleMarkets.push(market);
 }
 return result;
}

const quoteFingerprint = (market: BookMarket) =>
 JSON.stringify([market.marketKey, market.quotes.map(quote => quote.americanOdds)]);

function newestRevision(current: BookRevision|undefined, incoming: BookRevision): BookRevision {
 if (!current || incoming.at > current.at) return incoming;
 if (incoming.at < current.at) return current;
 if (current.state === 'WITHHELD' || incoming.state === 'WITHHELD') return {at: current.at, state: 'WITHHELD'};
 if (current.state === 'OPEN' && incoming.state === 'OPEN' && current.fingerprint === incoming.fingerprint) return current;
 return {at: current.at, state: 'CONFLICT'};
}

function projectPriceReview(approvedFeeds: number, sources: PriceReviewSource[], publishable: BookMarket[],
 rejectionCounts: Record<string,number>, now: number): PriceReview {
 const rejections = {...rejectionCounts};
 const byMarket = new Map<string,BookMarket[]>();
 let eligibleBookMarkets = 0;
 for (const market of publishable) {
  if (Date.parse(market.expiresAt) <= now) {
   count(rejections, 'EXPIRED_BEFORE_PUBLICATION'); continue;
  }
  eligibleBookMarkets++;
  append(byMarket, market.marketKey, market);
 }
 const corroborated: ReviewedMarket[] = [];
 for (const [id, markets] of byMarket) {
  const participating = markets.filter(a => markets.some(b =>
   a.providerId !== b.providerId && a.host !== b.host && a.operator !== b.operator && a.bookId !== b.bookId &&
   Math.abs(Date.parse(a.sourceUpdatedAt) - Date.parse(b.sourceUpdatedAt)) <= MAX_SOURCE_SKEW_MS));
  if (participating.length < 2) {
   count(rejections, 'NO_INDEPENDENT_COMPLETE_MARKET'); continue;
  }
  corroborated.push({...participating[0].identity, id,
   expiresAt: participating.map(x => x.expiresAt).sort()[0],
   sources: participating.map(x => ({bookmaker: sportsbookNames.get(x.bookId)!, providerId: x.providerId,
    sourceEventId: x.sourceEventId, sourceUpdatedAt: x.sourceUpdatedAt, expiresAt: x.expiresAt, quotes: x.quotes}))});
 }
 corroborated.sort((a,b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
 const respondedFeeds = sources.filter(validPriceReviewResponse).length;
 const status = !approvedFeeds ? 'NO_APPROVED_FEEDS' : !respondedFeeds ? 'APPROVED_FEEDS_UNAVAILABLE' :
  corroborated.length ? 'CORROBORATED' : eligibleBookMarkets ? 'NO_INDEPENDENT_MATCH' : 'NO_ELIGIBLE_MARKETS';
 return {schema: 'edgeforce-sportsbook-price-review-v1', status, approvedFeeds, respondedFeeds,
  rowsExamined: sources.reduce((sum, source) => sum + source.rowsExamined, 0), eligibleBookMarkets,
  corroboratedMarkets: corroborated.length, omittedMarkets: Math.max(0, corroborated.length - MAX_DISPLAY),
  inputTruncated: sources.some(source => source.truncated), rejections, markets: corroborated.slice(0, MAX_DISPLAY),
  recommendationsAuthorized: false};
}

// Keep revision fences, never publish prices carried over from an older poll.
// Entries expire once anything older than the fence falls outside the longest source window.
export function createPriceReviewTracker(maxGroups = MAX_TRACKED_GROUPS) {
 const history = new Map<string,BookRevision>();
 let saturatedUntil = 0;

 function capture(approvedFeeds: number, sources: PriceReviewSource[], now = Date.now()): PriceReviewSnapshot {
  const rejections: Record<string,number> = {};
  const publishable: BookMarket[] = [];
  for (const [group, revision] of history) {
   if (revision.at + MAX_AGE_MS <= now) history.delete(group);
  }
  for (const source of sources) {
   for (const [reason, total] of Object.entries(source.rejections)) rejections[reason] = (rejections[reason] || 0) + total;
   for (const [group, revision] of source.revisions) {
    if (revision.at + MAX_AGE_MS <= now) continue;
    const prior = history.get(group);
    if (!prior && history.size >= maxGroups) {
     saturatedUntil = Math.max(saturatedUntil, revision.at + MAX_AGE_MS);
     continue;
    }
    history.set(group, newestRevision(prior, revision));
   }
  }
  const conflictGroups = new Set<string>();
  if (now < saturatedUntil) count(rejections, 'REVISION_HISTORY_CAPACITY');
  else for (const source of sources) {
   for (const market of source.eligibleMarkets) {
    const latest = history.get(market.groupKey);
    if (!latest) continue;
    if (latest.state === 'CONFLICT') {
     conflictGroups.add(market.groupKey); continue;
    }
    if (latest.at !== Date.parse(market.sourceUpdatedAt) || latest.state !== 'OPEN') {
     count(rejections, 'BOOKMAKER_REVISION_WITHHELD'); continue;
    }
    publishable.push(market);
   }
  }
  if (conflictGroups.size) rejections.BOOKMAKER_PRICE_CONFLICT = conflictGroups.size;

  // Re-evaluate at the next expiry. A cached request never republishes expired
  // prices, and a surviving pair can still corroborate after a third source expires.
  const expiries = [...new Set(publishable.map(market => Date.parse(market.expiresAt)))].sort((a,b) => a-b);
  let expiryIndex = 0;
  let projectedAt = now;
  let value = projectPriceReview(approvedFeeds, sources, publishable, rejections, now);
  return {read(at = Date.now()) {
   const time = Math.max(now, at, projectedAt);
   if (time >= (expiries[expiryIndex] ?? Infinity)) {
    while (expiryIndex < expiries.length && expiries[expiryIndex] <= time) expiryIndex++;
    value = projectPriceReview(approvedFeeds, sources, publishable, rejections, time);
   }
   projectedAt = time;
   return value;
  }};
 }

 return {capture, build(approvedFeeds: number, sources: PriceReviewSource[], now = Date.now()) {
  return capture(approvedFeeds, sources, now).read(now);
 }};
}

export function buildPriceReview(approvedFeeds: number, sources: PriceReviewSource[], now = Date.now()): PriceReview {
 return createPriceReviewTracker().build(approvedFeeds, sources, now);
}
