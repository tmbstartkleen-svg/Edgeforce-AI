import {normalizeReadOnlyMarketBook,type RawMarketBook,type NormalizedMarketBook} from './readOnlyScalpMarketBook';

/**
 * Read-only exchange feed adapter. Transport is injected by the caller.
 * Does not fetch by itself, authenticate, place orders, or infer rule equivalence.
 * Only accepts an explicitly supplied verified settlement flag.
 */
export type ReadOnlyExchangeResponse={
 venue:'kalshi'|'polymarket_us';marketId:string;outcomeId:string;
 observedAt:string;sourceUrl:string;marketOpen:boolean;settlementVerified:boolean;
 bids:unknown;asks:unknown;currency:'USD';
};
export type ExchangeBookResult={status:'ready'|'blocked';book:NormalizedMarketBook|null;reasons:string[]};
export function ingestExchangeBook(
 input:ReadOnlyExchangeResponse,nowMs:number,maxAgeMs=30000
):ExchangeBookResult{
 if(!input||!Array.isArray(input.bids)||!Array.isArray(input.asks))
  return {status:'blocked',book:null,reasons:['missing_order_book_levels']};
 const levels=[...input.bids,...input.asks];
 if(levels.some(x=>!x||typeof x!=='object'||Array.isArray(x)||
  !Object.hasOwn(x,'price')||!Object.hasOwn(x,'quantity')))
  return {status:'blocked',book:null,reasons:['malformed_order_book_levels']};
 const raw:RawMarketBook={
  venue:input.venue,marketId:input.marketId,outcomeId:input.outcomeId,
  observedAt:input.observedAt,sourceUrl:input.sourceUrl,
  marketOpen:input.marketOpen,settlementVerified:input.settlementVerified,
  currency:input.currency,bids:input.bids as RawMarketBook['bids'],
  asks:input.asks as RawMarketBook['asks']
 };
 const book=normalizeReadOnlyMarketBook(raw,nowMs,maxAgeMs);
 return {status:book.status==='verified_read_only'?'ready':'blocked',
  book,reasons:book.reasons};
}
