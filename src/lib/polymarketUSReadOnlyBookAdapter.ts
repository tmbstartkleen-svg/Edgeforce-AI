import {ingestExchangeBook,type ExchangeBookResult} from './readOnlyExchangeBookIngestion';

/** Polymarket US read-only book normalization boundary.
 * Caller supplies an independently obtained snapshot for one outcome,
 * confirmed market status and reviewed settlement rules.
 * Does not assume API response shapes, issue requests, or place orders.
 */
export type PolymarketUSBookSnapshot={
 marketId:string;outcomeId:string;observedAt:string;sourceUrl:string;
 marketOpen:boolean;settlementVerified:boolean;
 bids:unknown;asks:unknown;
};
export function ingestPolymarketUSBook(
 snapshot:PolymarketUSBookSnapshot,nowMs:number,maxAgeMs=30000
):ExchangeBookResult{
 const blocked=(reason:string):ExchangeBookResult=>({status:'blocked',book:null,reasons:[reason]});
 if(!snapshot||!snapshot.marketId||!snapshot.outcomeId||
 !Array.isArray(snapshot.bids)||!Array.isArray(snapshot.asks))
  return blocked('invalid_polymarket_us_snapshot');
 const normalize=(levels:unknown[]):{price:number;quantity:number}[]|null=>{
  const result:{price:number;quantity:number}[]=[];
  for(const level of levels){
   if(!level||typeof level!=='object'||Array.isArray(level))return null;
   const x=level as Record<string,unknown>;
   // Strict numeric schema. Exchange-specific decimal strings must be
   // converted by a separately validated API transport adapter.
   if(typeof x.price!=='number'||typeof x.quantity!=='number'||
    !Number.isFinite(x.price)||x.price<=0||x.price>=1||
    !Number.isSafeInteger(x.quantity)||x.quantity<=0)return null;
   result.push({price:x.price,quantity:x.quantity});
  }
  return result;
 };
 const bids=normalize(snapshot.bids),asks=normalize(snapshot.asks);
 if(!bids||!asks)return blocked('malformed_polymarket_us_levels');
 return ingestExchangeBook({
  venue:'polymarket_us',marketId:snapshot.marketId,outcomeId:snapshot.outcomeId,
  observedAt:snapshot.observedAt,sourceUrl:snapshot.sourceUrl,
  marketOpen:snapshot.marketOpen,settlementVerified:snapshot.settlementVerified,
  currency:'USD',bids,asks
 },nowMs,maxAgeMs);
}
