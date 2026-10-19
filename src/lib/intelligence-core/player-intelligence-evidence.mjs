/** Pure quality gate for injuries, lineups, player stats and prop observations.
 * No market or model approval without source-dated, provider-scoped records.
 */
const KINDS=new Set(['injury','lineup','player-stat','prop']);
export function auditPlayerIntelligence(records=[],{now=Date.now(),maxAgeMs=86400000}={}){
 if(!Array.isArray(records)||records.length>500||!Number.isFinite(now))throw Error('INVALID_PLAYER_INTELLIGENCE_BATCH');
 const counts={injury:0,lineup:0,'player-stat':0,prop:0};
 const unique=new Set();let missingSource=0,missingIdentity=0,invalidTimestamp=0,stale=0,duplicates=0;
 for(const r of records){
  if(!r||!KINDS.has(r.kind))continue;
  if(typeof r.providerId!=='string'||!r.providerId.trim()||typeof r.upstreamId!=='string'||!r.upstreamId.trim()){missingSource++;continue;}
  if(typeof r.athleteId!=='string'||!r.athleteId.trim()||typeof r.eventId!=='string'||!r.eventId.trim()){missingIdentity++;continue;}
  const observed=Date.parse(r.observedAt??'');
  if(!Number.isFinite(observed)||observed>now+30000){invalidTimestamp++;continue;}
  if(now-observed>maxAgeMs){stale++;continue;}
  const key=JSON.stringify([r.providerId,r.upstreamId,r.eventId,r.athleteId,r.kind,r.observedAt,r.marketId??'']);
  if(unique.has(key)){duplicates++;continue;}
  unique.add(key);counts[r.kind]++;
 }
 return {counts,accepted:unique.size,rejected:missingSource+missingIdentity+invalidTimestamp+stale+duplicates,
  missingSource,missingIdentity,invalidTimestamp,stale,duplicates,
  sourceIdentityAuthenticated:false,injuryStatusIndependentlyVerified:false,
  playerStatModelApproved:false,propOddsVerified:false,betRecommendationAuthorized:false};
}
