// Independent odds coverage audit: diagnostics only, no inferred/model probabilities.
export type Quote={eventId:string;market:string;selection:string;bookmaker:string;upstreamId:string;americanOdds:number;observedAt:number};
export function auditIndependentOdds(quotes:Quote[],now=Date.now()){
 if(!Array.isArray(quotes)||quotes.length>500)throw Error('INVALID_AUDIT_BATCH');
 const groups=new Map<string,{books:Set<string>;upstreams:Set<string>;quotes:number;latestAgeMs:number;distinctQuoteKeys:Set<string>;duplicateQuotes:number}>();
 let rejected=0;
 for(const q of quotes){
  if(!q||![q.eventId,q.market,q.selection,q.bookmaker,q.upstreamId].every(x=>typeof x==='string'&&x.length>0&&x.length<=160)||
   !Number.isInteger(q.americanOdds)||q.americanOdds===0||Math.abs(q.americanOdds)<100||Math.abs(q.americanOdds)>100000||
   !Number.isFinite(q.observedAt)||q.observedAt>now+30000||now-q.observedAt>120000){rejected++;continue;}
  const key=JSON.stringify([q.eventId,q.market,q.selection]);
  const g=groups.get(key)||{books:new Set<string>(),upstreams:new Set<string>(),quotes:0,latestAgeMs:Infinity,distinctQuoteKeys:new Set<string>(),duplicateQuotes:0};
  const quoteKey=JSON.stringify([q.upstreamId,q.bookmaker,q.americanOdds,q.observedAt]);
  if(g.distinctQuoteKeys.has(quoteKey)){g.duplicateQuotes++;rejected++;groups.set(key,g);continue;}
  g.distinctQuoteKeys.add(quoteKey);
  g.books.add(q.bookmaker);g.upstreams.add(q.upstreamId);g.quotes++;g.latestAgeMs=Math.min(g.latestAgeMs,Math.max(0,now-q.observedAt));groups.set(key,g);
 }
 const markets=[...groups.entries()].map(([marketKey,g])=>({marketKey,quoteCount:g.quotes,duplicateQuotes:g.duplicateQuotes,bookCount:g.books.size,
  upstreamCount:g.upstreams.size,independentUpstreamRedundancy:g.upstreams.size>=2,
  latestAgeMs:g.latestAgeMs,bookmakerDiversityIsNotProviderIndependence:true}));
 return {audited:quotes.length,accepted:quotes.length-rejected,rejected,markets,
  marketsWithIndependentUpstreams:markets.filter(x=>x.independentUpstreamRedundancy).length,
  upstreamIdentityAuthenticated:false,oddsOfficiallyVerified:false,modelProbabilityVerified:false,betRecommendationAuthorized:false};
}
