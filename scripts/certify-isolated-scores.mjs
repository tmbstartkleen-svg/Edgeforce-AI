#!/usr/bin/env node
/**
 * Owner-operated isolated D1 score certification. This script NEVER changes
 * Worker settings, stores credentials, or targets production.
 *
 * Usage:
 * EDGEFORCE_PILOT_URL=https://edgeforce-d1-pilot.<account>.workers.dev \
 * EDGEFORCE_PILOT_CRON_SECRET=<secret-from-owner-shell> \
 * EDGEFORCE_CERT_SPORT=nba node scripts/certify-isolated-scores.mjs
 *
 * Both pilot flags must already be temporarily enabled by an authorized owner.
 * Restore them to false immediately after the bounded test.
 */
const url=process.env.EDGEFORCE_PILOT_URL||'';
const secret=process.env.EDGEFORCE_PILOT_CRON_SECRET||'';
const sport=process.env.EDGEFORCE_CERT_SPORT||'nba';
const approved=new Set(['nfl','ncaaf','nba','ncaab','wnba','mlb','nhl','soccer-epl','soccer-laliga','soccer-bundesliga','soccer-serie-a','soccer-ligue-1','soccer-mls','soccer-nwsl','soccer-ucl','soccer-uel']);
if(!/^https:\/\/edgeforce-d1-pilot\.[a-z0-9-]+\.workers\.dev\/?$/.test(url))throw Error('ISOLATED_PILOT_URL_REQUIRED');
if(secret.length<24)throw Error('OWNER_PILOT_SECRET_REQUIRED');
if(!approved.has(sport))throw Error('SPORT_NOT_APPROVED');
const root=url.replace(/\/$/,'');
const headers={authorization:'Bearer '+secret,accept:'application/json'};
async function call(path,method='GET'){
 const res=await fetch(root+path,{method,headers,redirect:'error',signal:AbortSignal.timeout(12000),cache:'no-store'});
 const body=await res.json().catch(()=>null);
 if(!body||typeof body!=='object')throw Error('NON_JSON_PILOT_RESPONSE_'+res.status);
 return {status:res.status,body};
}
function safe(result){return JSON.stringify(result);}
const readiness=await call('/api/operations/d1-pilot/score-collector-readiness');
if(readiness.status!==200||readiness.body.ok!==true)throw Error('READINESS_FAILED_'+readiness.status);
const item=readiness.body.sources?.find(x=>x.sport===sport);
if(!item?.approved)throw Error('SOURCE_NOT_APPROVED');
if(!readiness.body.flags?.collectionEnabled||!readiness.body.flags?.d1WriteEnabled)
 throw Error('STAGING_FLAGS_DISABLED: owner must explicitly activate both temporary switches');
const probe=await call('/api/operations/d1-pilot/probe-score-source?sport='+encodeURIComponent(sport));
if(probe.status!==200||probe.body.ok!==true||probe.body.classification!=='SCORES_NOT_ODDS'||probe.body.persisted!==false||probe.body.qualifyingSchedules+probe.body.qualifyingScores<1)
 throw Error('UPSTREAM_PROBE_FAILED_'+probe.status);
const ingest=await call('/api/operations/d1-pilot/collect-scores?sport='+encodeURIComponent(sport),'POST');
if(ingest.status!==200||ingest.body.ok!==true||ingest.body.classification!=='SCORES_NOT_ODDS'||ingest.body.accepted+ingest.body.duplicates<1)
 throw Error('PERSISTENCE_NOT_VERIFIED_'+ingest.status);
const recent=await call('/api/operations/d1-pilot/recent');
if(recent.status!==200||recent.body.ok!==true||!Array.isArray(recent.body.observations))throw Error('READBACK_FAILED');
const persisted=recent.body.observations.some(o=>o.source_id===item.sourceId&&o.observation_kind==='score');
if(!persisted)throw Error('NO_SOURCE_MATCHING_D1_READBACK: bounded recent window may be saturated; inspect D1 directly');
console.log(safe({ok:true,certification:'ISOLATED_SCORE_COLLECTION_ONLY',sport,sourceId:item.sourceId,
 attempted:ingest.body.attempted,accepted:ingest.body.accepted,duplicates:ingest.body.duplicates,
 matchedPersistedObservation:true,oddsCertified:false,productionChanged:false,
 reminder:'Immediately restore BOTH isolated collection and write switches to false; verify settings after rollback.'}));
