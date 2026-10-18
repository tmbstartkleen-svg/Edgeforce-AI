import {breakEvenProbability,calculateEdgeValue} from './edgeValue';

export type MarketQuoteEvidence={
  eventKey:string;
  marketKey:string;
  outcomeKey:string;
  americanOdds:number;
  sportsbook:string;
  upstreamId:string;
  observedAt:string;
};
export type MarketReferenceAudit={
  status:'INDEPENDENT_REFERENCE'|'INSUFFICIENT_REFERENCE';
  reasons:string[];
  targetBreakEvenPercent:number|null;
  modelEdgePp:number|null;
  modelExpectedRoiPercent:number|null;
  distinctSportsbooks:number;
  independentUpstreams:number;
  comparativeQuotes:Array<{sportsbook:string;upstreamId:string;americanOdds:number;breakEvenPercent:number}>;
};

/** Exact event, market, outcome, independent upstream and observed-at checks.
 * This establishes market reference quality, not prediction accuracy.
 */
export function auditMarketReferences(
 target:MarketQuoteEvidence,
 others:MarketQuoteEvidence[],
 modelProbability:number,
 nowIso:string,
 maxAgeMinutes=15
):MarketReferenceAudit{
 const reasons:string[]=[];
 const now=Date.parse(nowIso);
 if(!Number.isFinite(now)||!Number.isFinite(maxAgeMinutes)||maxAgeMinutes<=0)throw new RangeError('Invalid audit time or age');
 const good=(q:MarketQuoteEvidence)=>{
  const time=Date.parse(q.observedAt);
  return q.eventKey===target.eventKey&&q.marketKey===target.marketKey&&q.outcomeKey===target.outcomeKey&&
   !!q.sportsbook.trim()&&!!q.upstreamId.trim()&&Number.isFinite(time)&&time<=now&&now-time<=maxAgeMinutes*60000;
 };
 if(!good(target))reasons.push('TARGET_QUOTE_STALE_OR_INCOMPLETE');
 const normalized=others.filter(good);
 const unique=new Map<string,MarketQuoteEvidence>();
 for(const q of [target,...normalized]){
   try{breakEvenProbability(q.americanOdds);}catch{continue;}
   if(!good(q))continue;
   unique.set(q.sportsbook.toLowerCase()+'|'+q.upstreamId.toLowerCase(),q);
 }
 const independent=normalized.filter(q=>q.upstreamId.toLowerCase()!==target.upstreamId.toLowerCase()&&q.sportsbook.toLowerCase()!==target.sportsbook.toLowerCase());
 if(!independent.length)reasons.push('NO_INDEPENDENT_UPSTREAM_REFERENCE');
 const sportsbooks=new Set([...unique.values()].map(q=>q.sportsbook.toLowerCase()));
 const upstreams=new Set([...unique.values()].map(q=>q.upstreamId.toLowerCase()));
 if(sportsbooks.size<2)reasons.push('SINGLE_SPORTSBOOK');
 let value:ReturnType<typeof calculateEdgeValue>|null=null;
 try{value=calculateEdgeValue(target.americanOdds,modelProbability);}catch{reasons.push('INVALID_TARGET_PRICE_OR_PROBABILITY');}
 return {
  status:reasons.length?'INSUFFICIENT_REFERENCE':'INDEPENDENT_REFERENCE',
  reasons,
  targetBreakEvenPercent:value?value.breakEvenProbability*100:null,
  modelEdgePp:value?.probabilityEdgePp??null,
  modelExpectedRoiPercent:value?.expectedRoiPercent??null,
  distinctSportsbooks:sportsbooks.size,
  independentUpstreams:upstreams.size,
  comparativeQuotes:[...unique.values()].map(q=>({sportsbook:q.sportsbook,upstreamId:q.upstreamId,americanOdds:q.americanOdds,breakEvenPercent:breakEvenProbability(q.americanOdds)*100}))
 };
}
