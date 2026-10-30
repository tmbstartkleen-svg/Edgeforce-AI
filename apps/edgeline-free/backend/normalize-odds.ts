import { isFreshPrice, quoteIdentity } from '../lib/market-integrity';

type ProviderOutcome = {
  name: string;
  price: number;
  point?: number;
  link?: string;
};
type ProviderMarket = {
  key: string;
  last_update?: string;
  link?: string;
  outcomes: ProviderOutcome[];
};
type ProviderBookmaker = {
  key: string;
  last_update: string;
  link?: string;
  markets: ProviderMarket[];
};
type ProviderEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: ProviderBookmaker[];
};
type ProviderSport = {
  key: string;
  title: string;
  active: boolean;
  has_outrights: boolean;
};
type Quote = {
  bookPrices: {book:string;price:number;updatedAt:string}[];
  id: string;
  eventId: string;
  marketKey: string;
  marketLabel: string;
  draftKingsCategory: string;
  betType: string;
  selection: string;
  outcomeName: string;
  point: number | null;
  price: number;
  impliedProbability: number;
  noVigProbability: number;
  consensusProbability: number | null;
  consensusBooks: number;
  consensusEdge: number | null;
  updatedAt: string;
  link: string | null;
};
type FeedEvent = {
  id: string;
  sportKey: string;
  sport: string;
  startsAt: string;
  home: string;
  away: string;
};
export type DraftKingsCache = {
  fetchedAt: string | null;
  nextCheckAt: string;
  remaining: number | null;
  events: FeedEvent[];
  quotes: Quote[];
  problem: string | null;
  refreshDay: string;
  manualRefreshCount: number;
  refreshMessage: string | null;
};

const impliedProbability = (odds: number) =>
  odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100);
const marketName = (key: string) =>
  key === 'h2h' ? 'Moneyline' : key === 'spreads' ? 'Spread' : 'Total';
const selectionName = (market: string, outcome: ProviderOutcome) => {
  if (market === 'spreads' && Number.isFinite(outcome.point))
    return `${outcome.name} ${outcome.point! > 0 ? '+' : ''}${outcome.point}`;
  if (market === 'totals' && Number.isFinite(outcome.point))
    return `${outcome.name} ${outcome.point}`;
  return outcome.name;
};
const sameOutcome = (left: ProviderOutcome, right: ProviderOutcome) =>
  left.name === right.name &&
  (Number.isFinite(left.point) || Number.isFinite(right.point)
    ? left.point === right.point
    : true);
const bookmakerProbability = (
  book: ProviderBookmaker,
  marketKey: string,
  target: ProviderOutcome,
  expected: ProviderOutcome[],
) => {
  if(!book || !Array.isArray(book.markets))return null;
  const market = book.markets.find((item) => item && item.key === marketKey);
  if (!Array.isArray(market?.outcomes) || !market.outcomes.length) return null;
  if (!isFreshPrice(market.last_update ?? book.last_update)) return null;
  const outcomes = market.outcomes.filter(
    (item) =>
      item && typeof item.name === 'string' &&
      Number.isFinite(item.price) &&
      Math.abs(item.price) >= 100,
  );
  if(outcomes.length !== market.outcomes.length || outcomes.length !== expected.length || !expected.every(e=>outcomes.some(o=>sameOutcome(o,e))))return null;
  const targetIndex = outcomes.findIndex((item) => sameOutcome(item, target));
  if (targetIndex < 0 || outcomes.length < 2) return null;
  const implied = outcomes.map((item) => impliedProbability(item.price));
  const total = implied.reduce((sum, value) => sum + value, 0);
  return total > 0 ? (implied[targetIndex] / total) * 100 : null;
};

export function normalizeFeed(input: unknown) {
  if (!Array.isArray(input)) throw new Error('Invalid provider response');
  const events: FeedEvent[] = [];
  const quotes: Quote[] = [];
  for (const event of input as ProviderEvent[]) {
    if (
      !event ||
      typeof event.id !== 'string' || typeof event.home_team !== 'string' || typeof event.away_team !== 'string' || !Array.isArray(event.bookmakers) ||
      !Number.isFinite(Date.parse(event.commence_time))
    )
      continue;
    const book = event.bookmakers?.find((item) => item && item.key === 'draftkings');
    if (!book || !Array.isArray(book.markets)) continue;
    let validMarkets = 0;
    for (const market of book.markets ?? []) {
      if (
        !market || !['h2h', 'spreads', 'totals'].includes(market.key) ||
        !Array.isArray(market.outcomes)
      )
        continue;
      const outcomes = market.outcomes.filter(
        (item) =>
          item && typeof item.name === 'string' &&
          Number.isFinite(item.price) &&
          Math.abs(item.price) >= 100,
      );
      if (outcomes.length < 2 || outcomes.length !== market.outcomes.length || new Set(outcomes.map(o=>o.name)).size!==outcomes.length) continue;
      if(market.key==='spreads' && (outcomes.length!==2 || outcomes.some(o=>!Number.isFinite(o.point)) || outcomes[0].point!+outcomes[1].point! !== 0))continue;
      if(market.key==='totals' && (outcomes.length!==2 || outcomes.some(o=>!Number.isFinite(o.point)) || outcomes[0].point!==outcomes[1].point))continue;
      const updatedAt = market.last_update ?? book.last_update;
      if (!Number.isFinite(Date.parse(updatedAt))) continue;
      const implied = outcomes.map((item) => impliedProbability(item.price));
      const total = implied.reduce((sum, value) => sum + value, 0);
      validMarkets += 1;
      outcomes.forEach((outcome, index) => {
        const consensusValues = (event.bookmakers ?? [])
          .filter((item) => item && item.key !== 'draftkings')
          .map((item) => bookmakerProbability(item, market.key, outcome, outcomes))
          .filter((value): value is number => value !== null);
        const consensusProbability = consensusValues.length
          ? consensusValues.reduce((sum, value) => sum + value, 0) /
            consensusValues.length
          : null;
        const bookPrices=(event.bookmakers||[]).flatMap(b=>{
          if(bookmakerProbability(b,market.key,outcome,outcomes)===null)return [];
          const m=b.markets.find(m=>m.key===market.key)!;const o=m.outcomes.find(o=>sameOutcome(o,outcome))!;
          return [{book:b.key,price:o.price,updatedAt:m.last_update||b.last_update}];
        });
        quotes.push({bookPrices,
          id: quoteIdentity(
            event.id,
            market.key,
            selectionName(market.key, outcome),
          ),
          eventId: event.id,
          marketKey: market.key,
          marketLabel: marketName(market.key),
          draftKingsCategory: 'Game Lines',
          betType: marketName(market.key),
          selection: selectionName(market.key, outcome),
          outcomeName: outcome.name,
          point: Number.isFinite(outcome.point) ? outcome.point! : null,
          price: outcome.price,
          impliedProbability: Number((implied[index] * 100).toFixed(2)),
          noVigProbability: Number(((implied[index] / total) * 100).toFixed(2)),
          consensusProbability:
            consensusProbability === null
              ? null
              : Number(consensusProbability.toFixed(2)),
          consensusBooks: consensusValues.length,
          consensusEdge:
            consensusProbability === null
              ? null
              : Number(
                  (consensusProbability - implied[index] * 100).toFixed(2),
                ),
          updatedAt,
          link: outcome.link ?? market.link ?? book.link ?? null,
        });
      });
    }
    if (validMarkets)
      events.push({
        id: event.id,
        sportKey: event.sport_key,
        sport: event.sport_title,
        startsAt: event.commence_time,
        home: event.home_team,
        away: event.away_team,
      });
  }
  events.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return { events, quotes };
}

