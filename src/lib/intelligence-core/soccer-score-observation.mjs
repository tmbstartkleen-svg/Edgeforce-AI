/** Normalize real public scoreboard responses as UNAPPROVED score observations.
 * Upstream event IDs are source-scoped, not sportsbook fixture IDs.
 */
export function extractSoccerScoreObservations(data,{leagueId,observedAt,upstreamId='site.api.espn.com'}={}){
 if(!Array.isArray(data?.events)||typeof leagueId!=='string'||!leagueId.trim()||
  typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt)))return [];
 const seen=new Set(),out=[];
 for(const event of data.events.slice(0,100)){
  if(typeof event?.id!=='string'||!event.id.trim()||typeof event?.date!=='string'||!Number.isFinite(Date.parse(event.date)))continue;
  const key=leagueId+':'+event.id;
  if(seen.has(key))continue;seen.add(key);
  out.push({leagueId,eventId:event.id,scheduledAt:event.date,observedAt,upstreamId,
   sourceApproved:false,licensedOdds:false,providerId:'espn-public-scoreboard',
   status:'PUBLIC_SCORE_OBSERVATION_NOT_APPROVED_FOR_MARKET_RANKING'});
 }
 return out;
}
