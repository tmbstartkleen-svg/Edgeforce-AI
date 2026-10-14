/** Market-level soccer coverage evidence, informational until a licensed fixture join is available. */
export function soccerBoardEvidence(rows=[]){
 const soccer=rows.filter(x=>/soccer|football/i.test(String(x.sport||''))&&!/american|nfl|ncaaf|college/i.test(String(x.sport||'')));
 const detail=soccer.map(x=>({marketId:x.id,league:x.league||null,event:x.event||null,
  providerEventId:x.sourceEventId||null,book:x.sourceBook||null,
  scoreObservationLinked:false,licensedBookEvidenceLinked:false,
  status:'UNVERIFIED_FIXTURE_JOIN'}));
 return {boardSoccerRows:soccer.length,fixtureLinksVerified:0,marketLinksVerified:0,
   incompleteRows:detail.length,details:detail,gateEnforced:false,
   note:'Live-board market event IDs have not been reconciled against source-approved soccer D1 score observations and licensed league inventory; this report does not certify ranking eligibility.'};
}
