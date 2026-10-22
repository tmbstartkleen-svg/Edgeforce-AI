#!/usr/bin/env node
/**
 * Authenticated, read-only real D1 coverage matrix certification.
 * Verifies cross-endpoint agreement without collecting or modifying records.
 */
const base='https://edgeforce-d1-pilot.tmbstartkleen.workers.dev';
const secret=process.env.EDGEFORCE_PILOT_CRON_SECRET||'';
if(secret.length<24)throw Error('PILOT_SECRET_REQUIRED');
const headers={Authorization:'Bearer '+secret,Accept:'application/json'};
async function fetchJson(path){
 const res=await fetch(base+path,{headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
 const data=await res.json().catch(()=>null);
 if(res.status!==200||data?.ok!==true)throw Error('CERT_ENDPOINT_FAILED_'+res.status+'_'+String(data?.reason||'UNKNOWN'));
 return data;
}
const readiness=await fetchJson('/api/operations/d1-pilot/score-collector-readiness');
if(readiness.flags?.collectionEnabled!==false||readiness.flags?.d1WriteEnabled!==false)throw Error('COLLECTION_OR_WRITE_ENABLED');
const [matrix,history]=await Promise.all([
 fetchJson('/api/operations/d1-pilot/score-coverage-matrix?hours=168'),
 fetchJson('/api/operations/d1-pilot/score-history-audit?hours=168')
]);
if(matrix.mode!=='PERSISTED_SCORE_COVERAGE_MATRIX'||matrix.classification!=='SCORES_NOT_ODDS'||
 matrix.registeredSources!==16||matrix.scores?.length!==16)throw Error('MATRIX_CONTRACT_INVALID');
if(history.mode!=='READ_ONLY_SCORE_HISTORY_AUDIT'||history.classification!=='SCORES_NOT_ODDS'||
 history.sourceCount!==16)throw Error('HISTORY_CONTRACT_INVALID');
if(matrix.totalScoreObservations!==history.totalScoreObservations||
 matrix.sourcesWithPersistedEvidence!==history.coveredSources)throw Error('COVERAGE_TOTALS_DISAGREE');
const byId=new Map(history.bySport.map(x=>[x.sport,x]));
for(const row of matrix.scores){
 const reference=byId.get(row.sport);
 if(!reference||reference.sourceId!==row.sourceId||
 reference.observations!==row.persistedObservations||
 reference.distinctEvents!==row.distinctEvents||
 reference.actualPersistedEvidence!==row.hasPersistedEvidence)
  throw Error('COVERAGE_SOURCE_DISAGREEMENT_'+row.sport);
 if(row.verifiedOdds!==false||row.verifiedPlayerStats!==false||row.verifiedPredictions!==false)
  throw Error('UNVERIFIED_MARKET_EVIDENCE_'+row.sport);
}
console.log(JSON.stringify({ok:true,mode:'ISOLATED_SCORE_MATRIX_CROSSCHECK',registeredSources:16,
 persistedSources:matrix.sourcesWithPersistedEvidence,observations:matrix.totalScoreObservations,
 collectionEnabled:false,d1WriteEnabled:false,oddsCertified:false,productionChanged:false}));
