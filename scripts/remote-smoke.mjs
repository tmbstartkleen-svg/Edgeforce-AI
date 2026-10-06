import {execFileSync} from 'node:child_process';
const base=(process.env.SMOKE_BASE_URL||'').replace(/\/$/,'');
const expected=process.env.EXPECTED_APP_VERSION||'109.0.0';
if(!base)throw new Error('SMOKE_BASE_URL is required');

const paths=['/api/release/error-budget','/api/release/deployment-guard','/api/testing/ml-shadow-recovery','/api/intelligence/ml-shadow-recovery','/api/testing/ml-champion-drift','/api/intelligence/ml-drift','/api/testing/ml-first-tournament','/api/intelligence/ml-champions','/api/testing/ml-deployment','/api/ml/deploy-attest','/api/testing/ml-activation','/api/intelligence/ml-service','/api/testing/ml-tournament','/api/intelligence/ml-tournament','/api/testing/trained-models','/api/intelligence/trained-models','/api/testing/expert-models','/api/intelligence/expert-models','/api/testing/live-comeback','/api/live-comeback','/api/intelligence/validation-lab','/api/intelligence/context','/api/parlays?size=2&view=today','/api/health/live','/api/health','/api/health/ready','/api/release/readiness','/api/deployment/smoke','/api/diagnostics','/api/ops/status','/'];
const results=[];

function protectedFetch(path){
 const url=base+path;
 if(process.env.SMOKE_VERCEL_AUTH==='1'){
  const args=['curl',url];
  const body=execFileSync('vercel',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  return {ok:true,status:200,text:async()=>body};
 }
 return fetch(url,{redirect:'manual',headers:{'user-agent':'edgeforce-release-smoke/60'}});
}

for(const path of paths){
 const started=Date.now();
 const res=await protectedFetch(path);
 const body=await res.text();
 results.push({path,status:res.status,durationMs:Date.now()-started});
 if(!res.ok)throw new Error(path+' failed with '+res.status);
 if(path==='/api/release/error-budget'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V74'||json.schemaVersion!=='v74-slo-governor-1'||!json.windows)throw new Error('SLO governor endpoint mismatch');
 }
 if(path==='/api/release/deployment-guard'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V73'||json.schemaVersion!=='v73-deployment-guard-1'||!json.snapshot)throw new Error('deployment guard endpoint mismatch');
 }
 if(path==='/api/testing/ml-shadow-recovery'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.assertions?.repeatedFreshPassPromotes!==true||json.assertions?.badShadowRejected!==true||json.assertions?.cooldownBlocks!==true||json.assertions?.clearLeagueWinnerPromotes!==true||json.assertions?.closeLeagueRaceHolds!==true||json.assertions?.minimumCompetitorsRequired!==true||json.assertions?.leagueLeaderMustConfirm!==true)throw new Error('shadow league regression mismatch');
 }
 if(path==='/api/intelligence/ml-shadow-recovery'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V61'||json.schemaVersion!=='v61-shadow-league-1')throw new Error('shadow recovery intelligence mismatch');
 }
 if(path==='/api/testing/ml-champion-drift'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.assertions?.repeatedCriticalQuarantines!==true||json.assertions?.watchDoesNotQuarantine!==true)throw new Error('champion drift regression mismatch');
 }
 if(path==='/api/intelligence/ml-drift'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V59'||json.schemaVersion!=='v59-ml-champion-drift-1')throw new Error('champion drift intelligence mismatch');
 }
 if(path==='/api/testing/ml-first-tournament'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.assertions?.ranksWinner!==true||json.assertions?.blocksMissingArtifact!==true)throw new Error('first champion tournament regression mismatch');
 }
 if(path==='/api/intelligence/ml-champions'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V61'||json.schemaVersion!=='v61-first-champion-tournament-1')throw new Error('ML champion intelligence mismatch');
 }
 if(path==='/api/testing/ml-deployment'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.assertions?.releaseIdentity!==true||json.assertions?.activeRequiresChampion!==true)throw new Error('ML deployment regression mismatch');
 }
 if(path==='/api/ml/deploy-attest'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V61'||json.schemaVersion!=='v61-ml-deployment-attestation-1')throw new Error('ML deployment attestation mismatch');
 }
 if(path==='/api/testing/ml-activation'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.assertions?.active!==true||json.assertions?.awaitingEvidence!==true)throw new Error('ML activation state mismatch');
 }
 if(path==='/api/intelligence/ml-service'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V61'||json.schemaVersion!=='v61-ml-activation-1')throw new Error('ML activation status mismatch');
 }
 if(path==='/api/testing/ml-tournament'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.assertions?.promotesClearWinner!==true||json.assertions?.retainsIncumbentInsideMargin!==true||json.assertions?.blocksIneligible!==true)throw new Error('ML tournament regression mismatch');
 }
 if(path==='/api/intelligence/ml-tournament'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V55'||json.schemaVersion!=='v55-external-ml-tournament-1')throw new Error('ML tournament status mismatch');
 }
 if(path==='/api/testing/trained-models'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.assertions?.positiveSkill!==true||json.assertions?.promoted!==true)throw new Error('trained sport ML regression mismatch');
 }
 if(path==='/api/intelligence/trained-models'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V54'||json.schemaVersion!=='v54-trained-sport-ml-1')throw new Error('trained model status mismatch');
 }
 if(path==='/api/testing/expert-models'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.assertions?.councilIntegrated!==true)throw new Error('expert model regression mismatch');
 }
 if(path==='/api/intelligence/expert-models'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V61'||json.schemaVersion!=='v61-expert-models-1'||!Array.isArray(json.catalog))throw new Error('expert model API mismatch');
 }
 if(path==='/api/testing/live-comeback'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.assertions?.gameStateGuardrail!==true)throw new Error('live comeback regression mismatch');
 }
 if(path==='/api/live-comeback'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V52'||json.schemaVersion!=='v52-live-comeback-1'||json.gameStateVerified!==false)throw new Error('live comeback API mismatch');
 }
 if(path==='/api/intelligence/validation-lab'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V51'||!json.report?.overall)throw new Error('validation laboratory mismatch');
 }
 if(path==='/api/intelligence/context'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V51'||!json.diagnostics?.qualitySummary||!json.diagnostics?.publicNetwork)throw new Error('context intelligence mismatch');
 }
 if(path==='/api/parlays?size=2&view=today'){
  const json=JSON.parse(body);
  if(json.build!=='V51'||json.schemaVersion!=='v51-prediction-validation-1')throw new Error('parlay route schema mismatch');
  if(Number(json.thresholds?.recommendedMinJoint)!==0.52)throw new Error('parlay recommendation threshold mismatch');
  if(!Array.isArray(json.recommended)||!Array.isArray(json.valueWatchlist)||!Array.isArray(json.hailMary))throw new Error('parlay recommendation boards missing');
 }
 if(path==='/api/health/live'||path==='/api/health'||path==='/api/deployment/smoke'||path==='/api/ops/status'){
  const json=JSON.parse(body);
  if(json.version!==expected)throw new Error(path+' version mismatch');
 }
 if(path==='/api/health'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.productionHardened!==true)throw new Error('health hardening mismatch');
 }
 if(path==='/api/health/ready'||path==='/api/release/readiness'){
  const json=JSON.parse(body);
  if(json.ready!==true)throw new Error(path+' not ready');
 }
 if(path==='/api/deployment/smoke'){
  const json=JSON.parse(body);
  if(json.smoke!==true)throw new Error('deployment smoke mismatch');
 }
}

console.log(JSON.stringify({ok:true,base,expected,results}));
