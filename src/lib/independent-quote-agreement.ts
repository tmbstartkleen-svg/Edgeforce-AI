/**
 * Independently owned quote-source agreement analysis.
 * Sources are provenance-identified upstream operators, not bookmaker count.
 * External authentication and contractual entitlement remain separate gates.
 */
export type SourceQuote={
 upstreamId:string;bookmaker:string;eventId:string;marketType:string;
 outcomeId:string;americanOdds:number;observedAt:string;startsAt:string;
 line?:string;playerId?:string;
};
const text=(x:unknown)=>typeof x==='string'&&x.trim().length>0;
const identity=(q:SourceQuote)=>JSON.stringify([
 q.eventId.trim().toLowerCase(),q.marketType.trim().toLowerCase(),
 q.outcomeId.trim().toLowerCase(),q.line?.trim().toLowerCase()||'',
 q.playerId?.trim().toLowerCase()||'',q.bookmaker.trim().toLowerCase()
]);
const implied=(odds:number)=>odds>0?100/(odds+100):-odds/(-odds+100);
/**
 * Quotes are comparable only if they describe the SAME bookmaker, event,
 * market, outcome, line and player. Two different books are not automatically
 * evidence of a shared executable price.
 */
export function analyzeIndependentQuoteAgreement(quotes:SourceQuote[],now=Date.now(),
 toleranceProbabilityPoints=1.5){
 if(!Array.isArray(quotes)||quotes.length>1000||!Number.isFinite(now)||
  !Number.isFinite(toleranceProbabilityPoints)||toleranceProbabilityPoints<0||
  toleranceProbabilityPoints>10)throw Error('INVALID_SOURCE_AGREEMENT_INPUT');
 const buckets=new Map<string,SourceQuote[]>();
 const rejected:Record<string,number>={};
 const reject=(name:string)=>{rejected[name]=(rejected[name]||0)+1};
 for(const q of quotes){
  if(!q||![q.upstreamId,q.bookmaker,q.eventId,q.marketType,q.outcomeId].every(text)||
   !Number.isSafeInteger(q.americanOdds)||Math.abs(q.americanOdds)<100){
   reject('INVALID_QUOTE');continue;
  }
  if(q.marketType!=='h2h'&&!text(q.line)){reject('MISSING_LINE');continue}
  if(q.marketType.startsWith('player_')&&(!text(q.playerId)||q.playerId!.startsWith('name:'))){
   reject('PROVISIONAL_PLAYER');continue;
  }
  const observed=Date.parse(q.observedAt),start=Date.parse(q.startsAt);
  if(!Number.isFinite(observed)||observed>now||now-observed>15*60*1000||
    !Number.isFinite(start)||start<=now){reject('STALE_OR_STARTED');continue}
  const k=identity(q);buckets.set(k,[...(buckets.get(k)||[]),q]);
 }
 const comparisons=[];
 let corroborated=0,divergent=0,unmatched=0;
 for(const [key,group] of buckets){
  // Latest quote per distinct provider, not the number of bookmaker labels.
  const byUpstream=new Map<string,SourceQuote>();
  for(const q of group){
   const id=q.upstreamId.trim().toLowerCase();
   const prior=byUpstream.get(id);
   if(!prior||Date.parse(q.observedAt)>Date.parse(prior.observedAt))byUpstream.set(id,q);
  }
  if(byUpstream.size<2){unmatched++;continue}
  const probs=[...byUpstream.values()].map(q=>implied(q.americanOdds));
  const delta=(Math.max(...probs)-Math.min(...probs))*100;
  const agreement=delta<=toleranceProbabilityPoints;
  if(agreement)corroborated++;else divergent++;
  comparisons.push({identity:key,independentUpstreams:byUpstream.size,
   impliedProbabilitySpreadPoints:delta,priceAgreement:agreement});
 }
 return {mode:'SOURCE_QUOTE_AGREEMENT' as const,quotesReceived:quotes.length,
  comparedMarkets:comparisons.length,corroboratedMarkets:corroborated,
  divergentMarkets:divergent,unmatchedMarkets:unmatched,rejected,
  comparisons,hasCorroboratedQuotes:corroborated>0,releaseCertified:false,
  note:'Comparisons are arithmetic only. Input provenance, ownership, source entitlement and collection authenticity require separately verified evidence.'};
}
