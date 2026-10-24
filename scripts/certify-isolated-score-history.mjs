#!/usr/bin/env node
/**
 * Phase 2 history evidence certification. Read-only: never enables collectors or
 * writes to D1. Uses owner-managed Keychain secret via shell environment.
 */
const base='https://edgeforce-d1-pilot.tmbstartkleen.workers.dev';
const secret=process.env.EDGEFORCE_PILOT_CRON_SECRET||'';
if(secret.length<24)throw Error('PILOT_CRON_SECRET_REQUIRED');
const headers={Authorization:'Bearer '+secret,Accept:'application/json'};
async function read(endpoint){
 const r=await fetch(base+endpoint,{headers,signal:AbortSignal.timeout(15000),redirect:'error',cache:'no-store'});
 const data=await r.json().catch(()=>null);
 if(r.status!==200||data?.ok!==true)throw Error('AUDIT_ENDPOINT_UNAVAILABLE_'+r.status+'_'+String(data?.reason||'UNKNOWN'));
 return data;
}
const readiness=await read('/api/operations/d1-pilot/score-collector-readiness');
if(readiness.expected!==16||readiness.approved!==16)throw Error('SOURCE_REGISTRATION_INCOMPLETE');
if(readiness.flags.collectionEnabled!==false||readiness.flags.d1WriteEnabled!==false)
 throw Error('STAGING_FLAGS_NOT_DISABLED');
const audit=await read('/api/operations/d1-pilot/score-history-audit?hours=168');
if(audit.mode!=='READ_ONLY_SCORE_HISTORY_AUDIT'||audit.classification!=='SCORES_NOT_ODDS'||
 audit.sourceCount!==16||audit.oddsCertified!==false||audit.playerStatsCertified!==false||audit.predictionsCertified!==false)
 throw Error('HISTORY_AUDIT_CONTRACT_FAILURE');
const nhl=audit.bySport?.find(s=>s.sport==='nhl');
if(!nhl||!nhl.actualPersistedEvidence||nhl.observations<12)throw Error('HISTORICAL_NHL_RECEIPT_NOT_VISIBLE');
const total=audit.bySport.reduce((n,s)=>n+s.observations,0);
if(total!==audit.totalScoreObservations)throw Error('HISTORY_TOTAL_MISMATCH');
console.log(JSON.stringify({ok:true,mode:'READ_ONLY_REAL_D1_HISTORY_CERTIFICATION',coveredSources:audit.coveredSources,
 totalScoreObservations:audit.totalScoreObservations,nhlObservations:nhl.observations,nhlDistinctEvents:nhl.distinctEvents,
 sourceCount:audit.sourceCount,collectionEnabled:false,d1WriteEnabled:false,oddsCertified:false,playerStatsCertified:false,
 productionChanged:false}));
