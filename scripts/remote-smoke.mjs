import {setTimeout as delay} from 'node:timers/promises';
import {parseSmokeJson,shouldRetryDegradedHttp} from './remote-smoke-response.mjs';
import {createSmokeFetch} from './smoke-transport.mjs';
const base=(process.env.SMOKE_BASE_URL||'').replace(/\/$/,'');
const expected=process.env.EXPECTED_APP_VERSION||'119.0.0';
if(!base)throw new Error('SMOKE_BASE_URL is required');

const paths=['/api/release/error-budget','/api/release/deployment-guard','/api/testing/ml-shadow-recovery','/api/intelligence/ml-shadow-recovery','/api/testing/ml-champion-drift','/api/intelligence/ml-drift','/api/testing/ml-first-tournament','/api/intelligence/ml-champions','/api/testing/ml-deployment','/api/ml/deploy-attest','/api/testing/ml-activation','/api/intelligence/ml-service','/api/testing/ml-tournament','/api/intelligence/ml-tournament','/api/testing/trained-models','/api/intelligence/trained-models','/api/testing/expert-models','/api/intelligence/expert-models','/api/testing/live-comeback','/api/live-comeback','/api/intelligence/validation-lab','/api/intelligence/context','/api/parlays?size=2&view=today','/api/health/live','/api/health','/api/health/ready','/api/release/readiness','/api/deployment/smoke','/api/diagnostics','/api/ops/status','/'];
const results=[];
const degradedAllowedPaths=new Set([
 '/api/intelligence/expert-models',
 '/api/live-comeback',
 '/api/intelligence/context',
 '/api/parlays?size=2&view=today'
]);

const protectedFetch=createSmokeFetch({
 base,vercelAuth:process.env.SMOKE_VERCEL_AUTH==='1',
 curlArgs:url=>{
  const args=['curl',url];
  return args;
 }
});

for(const path of paths){
 const started=Date.now();
 let httpAttempt=0;
 let res;
 let body='';
 while(true){
  httpAttempt++;
  res=await protectedFetch(path);
  body=await res.text();
  if(shouldRetryDegradedHttp(path,res.status,degradedAllowedPaths)&&httpAttempt<3){
   console.error(`[remote-smoke] retry HTTP ${res.status} for ${path} (attempt ${httpAttempt}/3)`);
   await delay(1000*httpAttempt);
   continue;
  }
  break;
 }
 results.push({path,status:res.status,attempts:res.attempts,httpAttempts:httpAttempt,durationMs:Date.now()-started});
 console.error(`[remote-smoke] ${path}: HTTP ${res.status}, transport ${res.attempts} attempt(s), HTTP ${httpAttempt} attempt(s)`);
 if(!res.ok&&!degradedAllowedPaths.has(path))throw new Error(path+' failed with '+res.status);
 if(path==='/api/release/error-budget'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.schemaVersion!=='v74-slo-governor-1'||!json.windows)throw new Error('SLO governor endpoint mismatch');
 }
 if(path==='/api/release/deployment-guard'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.schemaVersion!=='v73-deployment-guard-1'||!json.snapshot)throw new Error('deployment guard endpoint mismatch');
 }
 if(path==='/api/testing/ml-shadow-recovery'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.assertions?.repeatedFreshPassPromotes!==true||json.assertions?.badShadowRejected!==true||json.assertions?.cooldownBlocks!==true||json.assertions?.clearLeagueWinnerPromotes!==true||json.assertions?.closeLeagueRaceHolds!==true||json.assertions?.minimumCompetitorsRequired!==true||json.assertions?.leagueLeaderMustConfirm!==true)throw new Error('shadow league regression mismatch');
 }
 if(path==='/api/intelligence/ml-shadow-recovery'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.schemaVersion!=='v61-shadow-league-1')throw new Error('shadow recovery intelligence mismatch');
 }
 if(path==='/api/testing/ml-champion-drift'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.assertions?.repeatedCriticalQuarantines!==true||json.assertions?.watchDoesNotQuarantine!==true)throw new Error('champion drift regression mismatch');
 }
 if(path==='/api/intelligence/ml-drift'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.schemaVersion!=='v59-ml-champion-drift-1')throw new Error('champion drift intelligence mismatch');
 }
 if(path==='/api/testing/ml-first-tournament'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.assertions?.ranksWinner!==true||json.assertions?.blocksMissingArtifact!==true)throw new Error('first champion tournament regression mismatch');
 }
 if(path==='/api/intelligence/ml-champions'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.schemaVersion!=='v61-first-champion-tournament-1')throw new Error('ML champion intelligence mismatch');
 }
 if(path==='/api/testing/ml-deployment'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.assertions?.releaseIdentity!==true||json.assertions?.activeRequiresChampion!==true)throw new Error('ML deployment regression mismatch');
 }
 if(path==='/api/ml/deploy-attest'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.schemaVersion!=='v61-ml-deployment-attestation-1')throw new Error('ML deployment attestation mismatch');
 }
 if(path==='/api/testing/ml-activation'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.assertions?.active!==true||json.assertions?.awaitingEvidence!==true)throw new Error('ML activation state mismatch');
 }
 if(path==='/api/intelligence/ml-service'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.schemaVersion!=='v61-ml-activation-1')throw new Error('ML activation status mismatch');
 }
 if(path==='/api/testing/ml-tournament'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.assertions?.promotesClearWinner!==true||json.assertions?.retainsIncumbentInsideMargin!==true||json.assertions?.blocksIneligible!==true)throw new Error('ML tournament regression mismatch');
 }
 if(path==='/api/intelligence/ml-tournament'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.schemaVersion!=='v55-external-ml-tournament-1')throw new Error('ML tournament status mismatch');
 }
 if(path==='/api/testing/trained-models'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.assertions?.positiveSkill!==true||json.assertions?.promoted!==true)throw new Error('trained sport ML regression mismatch');
 }
 if(path==='/api/intelligence/trained-models'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.schemaVersion!=='v54-trained-sport-ml-1')throw new Error('trained model status mismatch');
 }
 if(path==='/api/testing/expert-models'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.assertions?.councilIntegrated!==true)throw new Error('expert model regression mismatch');
 }
 if(path==='/api/intelligence/expert-models'){
  const json=parseSmokeJson(path,res.status,body);
  const degradedValid=json.ok===false&&json.schemaVersion==='v61-expert-models-1'&&Array.isArray(json.catalog)&&/No live or fresh stored sportsbook markets/i.test(String(json.error||''));
  const liveValid=json.ok===true&&json.schemaVersion==='v61-expert-models-1'&&Array.isArray(json.catalog);
  if(!(liveValid||degradedValid))throw new Error('expert model API mismatch');
 }
 if(path==='/api/testing/live-comeback'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.assertions?.gameStateGuardrail!==true)throw new Error('live comeback regression mismatch');
 }
 if(path==='/api/live-comeback'){
  const json=parseSmokeJson(path,res.status,body);
  const degradedValid=json.ok===false&&json.degraded===true&&json.schemaVersion==='v52-live-comeback-1'&&/No live or fresh stored sportsbook markets/i.test(String(json.error||''));
  const liveValid=json.ok===true&&json.schemaVersion==='v52-live-comeback-1'&&json.gameStateVerified===false;
  if(!(liveValid||degradedValid))throw new Error('live comeback API mismatch');
 }
 if(path==='/api/intelligence/validation-lab'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||!json.report?.overall)throw new Error('validation laboratory mismatch');
 }
 if(path==='/api/intelligence/context'){
  const json=parseSmokeJson(path,res.status,body);
  const degradedValid=json.ok===false&&json.degraded===true&&json.schemaVersion==='v51-context-intelligence-1'&&/No live or stored markets available/i.test(String(json.error||''));
  const liveValid=json.ok===true&&Boolean(json.diagnostics?.qualitySummary)&&Boolean(json.diagnostics?.publicNetwork);
  if(!(liveValid||degradedValid))throw new Error('context intelligence mismatch');
 }
 if(path==='/api/parlays?size=2&view=today'){
  const json=parseSmokeJson(path,res.status,body);
  const degradedValid=json.ok===false&&json.degraded===true&&json.schemaVersion==='v51-prediction-validation-1'&&/No live or fresh stored sportsbook markets/i.test(String(json.error||''));
  if(degradedValid)continue;
  if(json.schemaVersion!=='v51-prediction-validation-1')throw new Error('parlay route schema mismatch');
  if(Number(json.thresholds?.recommendedMinJoint)!==0.52)throw new Error('parlay recommendation threshold mismatch');
  if(!Array.isArray(json.recommended)||!Array.isArray(json.valueWatchlist)||!Array.isArray(json.hailMary))throw new Error('parlay recommendation boards missing');
 }
 if(path==='/api/health/live'||path==='/api/health'||path==='/api/deployment/smoke'||path==='/api/ops/status'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.version!==expected)throw new Error(path+' version mismatch');
 }
 if(path==='/api/health'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ok!==true||json.productionHardened!==true)throw new Error('health hardening mismatch');
 }
 if(path==='/api/health/ready'||path==='/api/release/readiness'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.ready!==true)throw new Error(path+' not ready');
 }
 if(path==='/api/deployment/smoke'){
  const json=parseSmokeJson(path,res.status,body);
  if(json.smoke!==true)throw new Error('deployment smoke mismatch');
 }
}

console.log(JSON.stringify({ok:true,base,expected,results}));
