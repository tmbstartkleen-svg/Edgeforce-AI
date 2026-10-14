// Join approved scoreboard fixtures with authorized sportsbook quotes by canonical competition+event IDs.
// All three independent evidence objects must be present; no fuzzy team-name guessing.
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const key=x=>nonempty(x?.leagueId)&&nonempty(x?.eventId)?x.leagueId.trim().toLowerCase()+':'+x.eventId.trim():null;
const validDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
export function joinAuthorizedSoccerMarkets({markets=[],scores=[],quotes=[],now=Date.now(),maxAgeMs=180000}={}){
 const scoreIndex=new Map();
 for(const s of scores){const k=key(s);if(k&&s.sourceApproved===true&&validDate(s.observedAt)&&Date.parse(s.observedAt)<=now&&now-Date.parse(s.observedAt)<=maxAgeMs)scoreIndex.set(k,s);}
 const quoteIndex=new Map();
 for(const q of quotes){const k=key(q);if(k&&q.licensed===true&&q.providerApproved===true&&validDate(q.observedAt)&&Date.parse(q.observedAt)<=now&&now-Date.parse(q.observedAt)<=maxAgeMs&&nonempty(q.book)&&nonempty(q.marketId)){
  const entries=quoteIndex.get(k)||new Set();entries.add(q.book.trim().toLowerCase()+':'+q.marketId.trim());quoteIndex.set(k,entries);
 }}
 const results=markets.map(m=>{
  const k=key(m),marketIdentifier=nonempty(m?.id)?m.id.trim():null;
  const q=k&&quoteIndex.get(k);
  const matched=Boolean(k&&marketIdentifier&&scoreIndex.has(k)&&nonempty(m?.sourceBook)&&q?.has(m.sourceBook.trim().toLowerCase()+':'+marketIdentifier));
  return {marketId:marketIdentifier,leagueId:m.leagueId||null,eventId:m.eventId||null,eligible:matched,
   reason:!k?'MISSING_CANONICAL_FIXTURE_ID':!scoreIndex.has(k)?'NO_FRESH_APPROVED_SCORE':!q?.has(String(m.sourceBook||'').trim().toLowerCase()+':'+marketIdentifier)?'NO_FRESH_LICENSED_QUOTE':'VERIFIED_EVIDENCE'};
 });
 return {results,approved:results.filter(x=>x.eligible).length,withheld:results.filter(x=>!x.eligible).length,
  joinsRequireExternalEvidence:true,fullDraftKingsInventoryCertified:false};
}
