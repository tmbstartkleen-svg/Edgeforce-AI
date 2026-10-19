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

/** Prepare separate, size-bounded preview batches across observed leagues.
 * Missing leagues are reported, never silently counted as covered.
 * No writes, odds approval, or DraftKings inventory certification.
 */
export function previewSoccerLeagueBatches(observations,{expectedLeagueIds=[]}={}){
 const expected=[...new Set(expectedLeagueIds)];
 const supplied=new Map();
 for(const entry of observations||[]){
  if(!entry||typeof entry.leagueId!=='string'||!entry.leagueId||supplied.has(entry.leagueId))continue;
  supplied.set(entry.leagueId,entry);
 }
 const leagues=[],batches=[];
 for(const leagueId of expected.length?expected:[...supplied.keys()]){
  const entry=supplied.get(leagueId);
  if(!entry){leagues.push({leagueId,observed:false,fixtureCount:0,batchCount:0});continue;}
  const observed=previewSoccerD1Events(entry.raw,{leagueId,observedAt:entry.observedAt});
  const rawRows=extractSoccerScoreObservations(entry.raw,{leagueId,observedAt:entry.observedAt});
  const allItems=[];
  for(let offset=0;offset<rawRows.length;offset+=25){
   const slice={events:entry.raw.events.slice(0,100).filter(event=>rawRows.slice(offset,offset+25).some(row=>row.eventId===event.id))};
   allItems.push(previewSoccerD1Events(slice,{leagueId,observedAt:entry.observedAt}).items);
  }
  for(const items of allItems)if(items.length)batches.push({type:'events',items,previewOnly:true,leagueId});
  leagues.push({leagueId,observed:true,fixtureCount:observed.totalObserved,batchCount:allItems.length});
 }
 return {previewOnly:true,sourceApprovedForMarketRanking:false,sportsbookOddsAvailable:false,
  draftKingsInventoryCertified:false,leagues,batches,missingLeagueIds:leagues.filter(x=>!x.observed).map(x=>x.leagueId)};
}
