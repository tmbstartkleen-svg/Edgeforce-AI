import {ingestExchangeBook,type ExchangeBookResult} from './readOnlyExchangeBookIngestion';

/**
 * Kalshi YES-side public orderbook conversion. Kalshi exposes resting YES
 * and NO bids, not a native YES ask array. A NO bid at p implies a YES ask
 * at 1-p, assuming the same binary contract and unit. Research-only.
 * Caller supplies independently verified settlement rules and market status.
 */
export type KalshiPublicBook={
 yes:unknown;no:unknown;
};
export type KalshiReadOnlyContext={
 marketId:string;outcomeId:'yes';observedAt:string;sourceUrl:string;
 marketOpen:boolean;settlementVerified:boolean;
};
export function ingestKalshiYesBook(
 payload:KalshiPublicBook,context:KalshiReadOnlyContext,nowMs:number,maxAgeMs=30000
):ExchangeBookResult{
 const blocked=(reason:string):ExchangeBookResult=>({status:'blocked',book:null,reasons:[reason]});
 if(!payload||!Array.isArray(payload.yes)||!Array.isArray(payload.no))
  return blocked('invalid_kalshi_book');
 const convert=(levels:unknown,complement:boolean)=>{
  if(!Array.isArray(levels))return null;
  const result:{price:number;quantity:number}[]=[];
  for(const level of levels){
   if(!Array.isArray(level)||level.length!==2||
    typeof level[0]!=='number'||typeof level[1]!=='number'||
    !Number.isFinite(level[0])||level[0]<=0||level[0]>=1||
    !Number.isSafeInteger(level[1])||level[1]<=0)return null;
   result.push({price:complement?Math.round((1-level[0])*1000000)/1000000:level[0],quantity:level[1]});
  }
  return result;
 };
 const bids=convert(payload.yes,false),asks=convert(payload.no,true);
 if(!bids||!asks)return blocked('invalid_kalshi_levels');
 return ingestExchangeBook({
  venue:'kalshi',marketId:context.marketId,outcomeId:context.outcomeId,
  observedAt:context.observedAt,sourceUrl:context.sourceUrl,
  marketOpen:context.marketOpen,settlementVerified:context.settlementVerified,
  currency:'USD',bids,asks
 },nowMs,maxAgeMs);
}
