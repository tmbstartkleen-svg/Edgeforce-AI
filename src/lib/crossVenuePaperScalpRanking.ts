import type {NormalizedMarketBook} from './readOnlyScalpMarketBook';

/**
 * Research-only cross-venue scalp candidate ranking.
 * A bid/ask spread is NOT executable profit: buying at the bid and selling at the ask requires passive fills on both sides; buy and sell fills may never
 * happen, fees may change, and settlement rules may differ. No orders sent.
 */
export type ScalpCandidate={
 venue:'kalshi'|'polymarket_us';marketId:string;outcomeId:string;
 entryLimit:number;exitLimit:number;estimatedNetPerContract:number;
 availableContracts:number;estimatedNetAtDepth:number;
 status:'indicative_spread'|'blocked';reasons:string[];
};
export type ScalpRankSettings={
 maxSpread:number;minimumNetPerContract:number;buyFeePerContract:number;
 sellFeePerContract:number;maxContracts:number;tickSize:number;
};
export function rankSingleMarketScalps(
 books:NormalizedMarketBook[],settings:ScalpRankSettings
):ScalpCandidate[]{
 const validSettings=!!settings&&
 [settings.maxSpread,settings.minimumNetPerContract,settings.buyFeePerContract,
  settings.sellFeePerContract,settings.tickSize].every(n=>Number.isFinite(n)&&n>=0)&&
 settings.tickSize>0&&settings.tickSize<1&&
 Number.isSafeInteger(settings.maxContracts)&&settings.maxContracts>0;
 return books.map(book=>{
  const reasons:string[]=[];
  if(!validSettings)reasons.push('invalid_risk_settings');
  if(book.status!=='verified_read_only'||!Number.isFinite(book.bestBid)||
   !Number.isFinite(book.bestAsk)||book.bestBid<=0||book.bestAsk>=1||
   book.bestBid>book.bestAsk)reasons.push('unverified_or_invalid_book');
  if(!Number.isSafeInteger(book.bidDepth)||!Number.isSafeInteger(book.askDepth)||
   book.bidDepth<=0||book.askDepth<=0)reasons.push('insufficient_liquidity');
  const tick=validSettings?settings.tickSize:.01;
  const entryLimit=Math.floor(book.bestBid/tick+1e-9)*tick;
  const exitLimit=Math.ceil(book.bestAsk/tick-1e-9)*tick;
  const estimatedNetPerContract=exitLimit-entryLimit-
   (validSettings?settings.buyFeePerContract+settings.sellFeePerContract:0);
  if(validSettings&&book.bestAsk-book.bestBid>settings.maxSpread)
   reasons.push('spread_exceeds_limit');
  if(validSettings&&estimatedNetPerContract<settings.minimumNetPerContract)
   reasons.push('insufficient_theoretical_margin');
  if(entryLimit<=0||exitLimit>=1||entryLimit>=exitLimit)
   reasons.push('unreachable_or_invalid_limits');
  const availableContracts=validSettings?Math.min(book.bidDepth,book.askDepth,settings.maxContracts):0;
  if(availableContracts<=0)reasons.push('no_quoted_depth');
  return {venue:book.venue,marketId:book.marketId,outcomeId:book.outcomeId,
   entryLimit,exitLimit,estimatedNetPerContract,availableContracts,
   estimatedNetAtDepth:estimatedNetPerContract*availableContracts,
   status:reasons.length?'blocked':'indicative_spread',reasons};
 }).sort((a,b)=>{
  if(a.status!==b.status)return a.status==='indicative_spread'?-1:1;
  return b.estimatedNetAtDepth-a.estimatedNetAtDepth;
 });
}
