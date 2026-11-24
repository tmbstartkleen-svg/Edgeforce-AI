/**
 * Research-only ranking of opportunities from normalized, independently sourced
 * feeds. Never fabricates odds, fills, fee evidence or settlement equivalence.
 */
export type DiscoveryOpportunity={
 id:string;strategy:'complete_set'|'cross_venue'|'sportsbook_arb'|'positive_ev'|'market_making';
 sport:string;eventId:string;marketId:string;venues:string[];
 observedAt:string;sourceUrls:string[];
 estimatedNetProfit:number;capitalRequired:number;
 availableCapitalCapacity:number;settlementVerified:boolean;
 feesVerified:boolean;liquidityVerified:boolean;quotesVerified:boolean;
 /** Independent probability validation required for +EV strategies. */
 modelValidated:boolean;
};
export type RankedDiscovery=DiscoveryOpportunity&{
 status:'actionable_research'|'review_required'|'rejected';
 roi:number|null;reasons:string[];
};
export function rankMarketDiscoveries(items:DiscoveryOpportunity[],nowMs:number,maxQuoteAgeMs=30000):RankedDiscovery[]{
 if(!Number.isFinite(nowMs)||!Number.isFinite(maxQuoteAgeMs)||maxQuoteAgeMs<=0)return [];
 return items.map(item=>{
  const reasons:string[]=[];
  const age=nowMs-Date.parse(item.observedAt);
  if(!Number.isFinite(age)||age<0||age>maxQuoteAgeMs)reasons.push('stale_or_invalid_quote');
  if(!item.quotesVerified||!item.sourceUrls.length||item.sourceUrls.some(url=>!/^https:\/\//.test(url)))reasons.push('missing_quote_provenance');
  if(!item.settlementVerified)reasons.push('unverified_settlement_rules');
  if(!item.feesVerified)reasons.push('unverified_fees');
  if(!item.liquidityVerified)reasons.push('unverified_liquidity');
  if(!Number.isFinite(item.capitalRequired)||item.capitalRequired<=0||
   !Number.isFinite(item.availableCapitalCapacity)||item.availableCapitalCapacity<item.capitalRequired)
   reasons.push('insufficient_or_invalid_capital_capacity');
  if(!Number.isFinite(item.estimatedNetProfit)||item.estimatedNetProfit<=0)reasons.push('nonpositive_or_invalid_net_profit');
  if(item.strategy==='positive_ev'&&!item.modelValidated)reasons.push('uncalibrated_probability_model');
  const roi=Number.isFinite(item.estimatedNetProfit)&&Number.isFinite(item.capitalRequired)&&item.capitalRequired>0?
   item.estimatedNetProfit/item.capitalRequired:null;
  return {...item,roi,reasons,status:reasons.length?'review_required':'actionable_research'} as RankedDiscovery;
 }).sort((a,b)=>{
  if(a.status!==b.status)return a.status==='actionable_research'?-1:1;
  return (b.roi??-Infinity)-(a.roi??-Infinity);
 });
}
