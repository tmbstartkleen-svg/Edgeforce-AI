/** Read-only normalized exchange quote evidence. No requests or order execution. */
export type QuoteVenue='kalshi'|'polymarket_us';
export type QuoteSide='yes'|'no';
export type MarketQuoteEvidence={
 venue:QuoteVenue;marketId:string;eventId:string;outcomeId:string;side:QuoteSide;
 askPrice:number;availableContracts:number;observedAt:string;
 settlementFingerprint:string;currency:'USD';sourceUrl:string;
 /** Explicit verification from a separate market-rule review; never inferred from a shared event name. */
 settlementVerified:boolean;
};
export type QuoteComparison={
 status:'invalid'|'stale'|'unverified'|'insufficient_liquidity'|'candidate';
 costPerSet:number|null;grossProfitPerSet:number|null;maxSets:number;
 warning:string;
};
/**
 * Returns a *candidate*, never an executable guarantee. Both asks are normalized
 * to USD per $1 YES/NO payout, with explicit matching settlement fingerprint.
 * Fee schedules, queue priority and actual fills remain unverified.
 */
export function compareComplementaryQuotes(
 yes:MarketQuoteEvidence,no:MarketQuoteEvidence,nowMs:number,maxAgeMs=30000
):QuoteComparison{
 const warning='Read-only candidate, not guaranteed profit. Verify venue-specific fees, settlement/void equivalence, liquidity, order fills and contract payout before trading.';
 const fail=(status:QuoteComparison['status']):QuoteComparison=>({status,costPerSet:null,grossProfitPerSet:null,maxSets:0,warning});
 const valid=(q:MarketQuoteEvidence)=>q&&['kalshi','polymarket_us'].includes(q.venue)&&
  !!q.marketId&&!!q.eventId&&!!q.outcomeId&&!!q.sourceUrl&&
  q.currency==='USD'&&Number.isFinite(q.askPrice)&&q.askPrice>0&&q.askPrice<1&&
  Number.isSafeInteger(q.availableContracts)&&q.availableContracts>=0&&
  Number.isFinite(Date.parse(q.observedAt));
 if(!valid(yes)||!valid(no)||yes.side!=='yes'||no.side!=='no'||
  !Number.isFinite(nowMs)||!Number.isFinite(maxAgeMs)||maxAgeMs<=0)return fail('invalid');
 const ages=[yes,no].map(q=>nowMs-Date.parse(q.observedAt));
 if(ages.some(age=>age<0||age>maxAgeMs))return fail('stale');
 if(!yes.settlementVerified||!no.settlementVerified||
  !yes.settlementFingerprint||yes.settlementFingerprint!==no.settlementFingerprint||
  yes.eventId!==no.eventId||yes.outcomeId!==no.outcomeId)return fail('unverified');
 const maxSets=Math.min(yes.availableContracts,no.availableContracts);
 if(maxSets===0)return fail('insufficient_liquidity');
 const costPerSet=yes.askPrice+no.askPrice;
 return {status:'candidate',costPerSet,grossProfitPerSet:1-costPerSet,maxSets,warning};
}
