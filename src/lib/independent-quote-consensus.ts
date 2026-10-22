/** Quote-level provenance evidence. Never equate bookmaker count with independent data sources. */
export type ConsensusQuote = {
 upstreamId:string; providerId:string; bookmaker:string; eventId:string;
 marketType:string; outcomeId:string; observedAt:string; startsAt:string;
 priceAmerican:number; playerId?:string; line?:string;
};
const norm=(s:string)=>s.trim().toLowerCase();
const required=(s:unknown)=>typeof s==='string'&&s.trim().length>0;
const quoteKey=(q:ConsensusQuote)=>[q.bookmaker,q.eventId,q.marketType,q.playerId||'',q.outcomeId,q.line||''].map(norm).join('|');
/** Returns corroborated outcomes only when distinct upstream owners observed the same priced outcome within a narrow window. */
export function independentQuoteConsensus(quotes:ConsensusQuote[], now:string, maxAgeMs=60000, matchWindowMs=30000){
 const time=Date.parse(now);
 if(!Number.isFinite(time)||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>86400000||
    !Number.isSafeInteger(matchWindowMs)||matchWindowMs<0||matchWindowMs>maxAgeMs)
  throw new Error('INVALID_CONSENSUS_WINDOW');
 const groups=new Map<string,ConsensusQuote[]>();
 let rejected=0;
 for(const q of quotes){
  if(!q||![q.upstreamId,q.providerId,q.bookmaker,q.eventId,q.marketType,q.outcomeId,q.observedAt,q.startsAt].every(required)||
     !Number.isInteger(q.priceAmerican)||Math.abs(q.priceAmerican)<100||
     !Number.isFinite(Date.parse(q.observedAt))||!Number.isFinite(Date.parse(q.startsAt))||
     Date.parse(q.startsAt)<=time||time-Date.parse(q.observedAt)<0||time-Date.parse(q.observedAt)>maxAgeMs){
   rejected++;continue;
  }
  const k=quoteKey(q);
  groups.set(k,[...(groups.get(k)||[]),q]);
 }
 const verified:{key:string;upstreams:string[];providers:string[];pricesAmerican:number[];observedAt:string[]}[]=[];
 for(const [key,items] of groups){
  const sorted=[...items].sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
  let selected:ConsensusQuote[]=[];
  // Compare only same-event, same-bookmaker, same-outcome and line observations.
  // An aggregator with two branded providers remains one upstream.
  for(let i=0;i<sorted.length;i++){
   const window=sorted.filter(q=>Math.abs(Date.parse(q.observedAt)-Date.parse(sorted[i].observedAt))<=matchWindowMs);
   const unique=new Map<string,ConsensusQuote>();
   for(const q of window)unique.set(norm(q.upstreamId),q);
   if(unique.size>=2&&unique.size>new Set(selected.map(q=>norm(q.upstreamId))).size)selected=[...unique.values()];
  }
  if(selected.length>=2)verified.push({key,upstreams:selected.map(q=>q.upstreamId),providers:selected.map(q=>q.providerId),
   pricesAmerican:selected.map(q=>q.priceAmerican),observedAt:selected.map(q=>q.observedAt)});
 }
 return {asOf:new Date(time).toISOString(),verified,verifiedOutcomes:verified.length,observedOutcomes:groups.size,rejected,
  note:'Independent upstream corroboration only, not proof of executable prices or positive expected value.'};
}
