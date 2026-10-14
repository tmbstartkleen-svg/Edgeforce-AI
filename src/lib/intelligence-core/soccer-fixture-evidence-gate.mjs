// Fixture evidence is a score-feed signal, never sportsbook market proof.
const asKey=x=>[x?.leagueId,x?.eventId].map(y=>String(y??'').trim()).join(':');
export function gateSoccerFixtures({requested=[],observed=[],marketQuoted=[]}={}){
 const scores=new Set(observed.filter(x=>x?.leagueId&&x?.eventId).map(asKey));
 const odds=new Set(marketQuoted.filter(x=>x?.leagueId&&x?.eventId&&x?.authorized===true).map(asKey));
 const records=requested.filter(x=>x?.leagueId&&x?.eventId).map(f=>{
  const key=asKey(f),scoreFeedSeen=scores.has(key),authorizedOddsSeen=odds.has(key);
  return {...f,scoreFeedSeen,authorizedOddsSeen,rankable:scoreFeedSeen&&authorizedOddsSeen,
   reason:!scoreFeedSeen?'MISSING_SCORE_EVIDENCE':!authorizedOddsSeen?'NO_AUTHORIZED_MARKET':'READY_FOR_ADDITIONAL_GATES'};
 });
 return {fixtures:records,total:records.length,rankable:records.filter(x=>x.rankable).length,
   missingScores:records.filter(x=>!x.scoreFeedSeen).length,
   missingOdds:records.filter(x=>!x.authorizedOddsSeen).length,
   actualOddsProvided:marketQuoted.length>0,fullDraftKingsInventoryCertified:false};
}
