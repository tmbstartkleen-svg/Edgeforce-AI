import {extractSoccerScoreObservations} from './soccer-score-observation.mjs';

// Generate a reviewable D1-pilot candidate payload, never directly write to D1.
// ESPN public scoreboard data is NOT DraftKings inventory or betting odds.
export function previewSoccerD1Events(raw,{leagueId,observedAt}={}){
 const rows=extractSoccerScoreObservations(raw,{leagueId,observedAt});
 const items=rows.slice(0,25).map(row=>({
  id:'espn:'+row.leagueId+':'+row.eventId,
  provider_event_id:'espn:'+row.leagueId+':'+row.eventId,
  sport:'soccer',league:row.leagueId,
  start_time:new Date(row.scheduledAt).toISOString(),
  source:'espn-public-scoreboard',
  observed_at:new Date(row.observedAt).toISOString(),
  status:'unverified-public-fixture'
 }));
 return {type:'events',items,previewOnly:true,sourceApprovedForMarketRanking:false,
  sportsbookOddsAvailable:false,draftKingsInventoryCertified:false,
  totalObserved:rows.length,truncated:rows.length>25};
}
