import assert from 'node:assert/strict';
import test from 'node:test';
import {createSmokeFetch,parseCurlResponse} from '../scripts/smoke-transport.mjs';

const base='https://candidate.example.test';
const envelope=(body,status=200)=>({stdout:body+'\n__EDGEFORCE_HTTP_STATUS__'+status,stderr:'CLI banner, not response JSON'});
const transport=(options={})=>createSmokeFetch({base,sleep:async()=>{},...options});

test('curl reset retries once and returns actual body, status and attempt count',async()=>{
 let calls=0;
 const notices=[];
 const probe=transport({vercelAuth:true,onRetry:x=>notices.push(x),execImpl:async(command,args,options)=>{
  assert.equal(command,'vercel');
  assert.deepEqual(args.slice(0,5),['curl','/api/health','--deployment',base,'--']);
  assert.ok(args.includes('--max-time'));
  assert.ok(options.timeout>0&&options.maxBuffer>0);
  assert.ok(!args.includes('--insecure'));
  if(++calls===1)throw Object.assign(new Error('reset; secret must not be printed'),{code:35});
  return envelope('{"ok":true}');
 }});
 const result=await probe('/api/health');
 assert.equal(result.status,200);
 assert.equal(result.ok,true);
 assert.equal(result.attempts,2);
 assert.deepEqual(JSON.parse(await result.text()),{ok:true});
 assert.equal(notices.length,1);
});

test('persistent curl resets stop after three tries without exposing stderr',async()=>{
 let calls=0;
 const probe=transport({vercelAuth:true,execImpl:async()=>{
  calls++;
  throw Object.assign(new Error('private protection token'),{code:35,stderr:'private protection token'});
 }});
 await assert.rejects(probe('/api/health'),error=>/after 3 attempt/.test(error.message)&&!error.message.includes('private'));
 assert.equal(calls,3);
});

test('certificate, CLI authentication and missing executable failures are not retried',async()=>{
 for(const code of [60,1,'ENOENT']){
  let calls=0;
  const probe=transport({vercelAuth:true,execImpl:async()=>{calls++;throw Object.assign(new Error('failure'),{code});}});
  await assert.rejects(probe('/api/health'),/non-retryable/);
  assert.equal(calls,1);
 }
});

test('HTTP errors and redirects retain their real status and never trigger retries',async()=>{
 for(const status of [302,401,403,404,429,500,503]){
  let calls=0;
  const probe=transport({vercelAuth:true,execImpl:async()=>{calls++;return envelope('{"ok":false}',status);}});
  const result=await probe('/api/health');
  assert.equal(result.ok,false);
  assert.equal(result.status,status);
  assert.equal(calls,1);
 }
});

test('missing, noisy and invalid CLI status envelopes fail closed',async()=>{
 for(const stdout of ['{"ok":true}','{"ok":true}\n__EDGEFORCE_HTTP_STATUS__000','{}\n__EDGEFORCE_HTTP_STATUS__200\nCLI noise']){
  assert.throws(()=>parseCurlResponse(stdout),/HTTP status/);
  let calls=0;
  const probe=transport({vercelAuth:true,execImpl:async()=>{calls++;return {stdout};}});
  await assert.rejects(probe('/api/health'),/non-retryable/);
  assert.equal(calls,1);
 }
 const body='{"text":"__EDGEFORCE_HTTP_STATUS__503"}';
 assert.deepEqual(parseCurlResponse(envelope(body).stdout),{status:200,body});
});

test('truncated responses are discarded before the next attempt',async()=>{
 let calls=0;
 const probe=transport({vercelAuth:true,execImpl:async()=>{
  if(++calls===1)throw Object.assign(new Error('partial'),{code:18,stdout:'{"partial":'});
  return envelope('{"complete":true}');
 }});
 assert.deepEqual(JSON.parse(await (await probe('/api/health')).text()),{complete:true});
});

test('native fetch retries reset failures and preserves HTTP 503',async()=>{
 let calls=0;
 const probe=transport({fetchImpl:async(url,options)=>{
  assert.equal(url,base+'/api/health');
  assert.equal(options.redirect,'manual');
  assert.ok(options.signal);
  if(++calls===1)throw Object.assign(new TypeError('fetch failed'),{cause:{code:'ECONNRESET'}});
  return new Response('{"ready":false}',{status:503});
 }});
 const result=await probe('/api/health');
 assert.equal(result.status,503);
 assert.equal(result.ok,false);
 assert.equal(result.attempts,2);
});

test('native response size and schema content are not hidden by retries',async()=>{
 let calls=0;
 const large=transport({maxBytes:3,fetchImpl:async()=>{calls++;return new Response('large');}});
 await assert.rejects(large('/api/health'),/non-retryable/);
 assert.equal(calls,1);
 const invalid=transport({fetchImpl:async()=>new Response('not JSON')});
 const result=await invalid('/api/health');
 assert.throws(()=>JSON.parse('not JSON'));
 assert.equal(await result.text(),'not JSON');
});

test('deadline includes stalled native response bodies and releases the reader',async()=>{
 let cancelled=false;
 const keepAlive=setTimeout(()=>{},1000);
 try{
  const probe=transport({timeoutMs:20,maxAttempts:1,fetchImpl:async()=>new Response(new ReadableStream({
   cancel(){cancelled=true;}
  }))});
  await assert.rejects(probe('/api/health'),/timeout/);
  assert.equal(cancelled,true);
 }finally{clearTimeout(keepAlive);}
});

test('suite budget bounds repeated requests, not just individual attempts',async()=>{
 let clock=0,calls=0;
 const probe=transport({budgetMs:100,now:()=>clock,vercelAuth:true,execImpl:async()=>{calls++;return envelope('{}');}});
 await probe('/api/health');
 clock=101;
 await assert.rejects(probe('/api/health'),/suite deadline/);
 assert.equal(calls,1);
});

test('invalid options and off-deployment paths fail before a request is made',async()=>{
 assert.throws(()=>transport({base:'https://user:secret@example.test'}),/without credentials/);
 assert.throws(()=>transport({base:'https://candidate.example.test/path'}),/origin/);
 for(const options of [{maxAttempts:4},{timeoutMs:NaN},{budgetMs:0}])assert.throws(()=>transport(options));
 const probe=transport({execImpl:async()=>{assert.fail('must not execute');}});
 for(const path of ['//other.test','https://other.test','/\\other.test','/api/health\n']){
  await assert.rejects(probe(path),/selected deployment/);
 }
});

test('CLI process timeout is bounded and retried, buffer overflow is not',async()=>{
 let calls=0;
 const probe=transport({vercelAuth:true,execImpl:async()=>{
  if(++calls===1)throw Object.assign(new Error('timeout'),{killed:true,signal:'SIGKILL',code:null});
  return envelope('{}');
 }});
 assert.equal((await probe('/api/health')).attempts,2);
 let overflows=0;
 const overflow=transport({vercelAuth:true,execImpl:async()=>{
  overflows++;
  throw Object.assign(new Error('too much output'),{killed:true,signal:'SIGKILL',code:'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'});
 }});
 await assert.rejects(overflow('/api/health'),/non-retryable/);
 assert.equal(overflows,1);
});

// Exercise the complete existing smoke runner against an HTTP fixture, not
// only mocked transport methods. These are synthetic regression fixtures.
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const schemas={
 '/api/release/error-budget':'v74-slo-governor-1',
 '/api/release/deployment-guard':'v73-deployment-guard-1',
 '/api/intelligence/ml-shadow-recovery':'v61-shadow-league-1',
 '/api/intelligence/ml-drift':'v59-ml-champion-drift-1',
 '/api/intelligence/ml-champions':'v61-first-champion-tournament-1',
 '/api/ml/deploy-attest':'v61-ml-deployment-attestation-1',
 '/api/intelligence/ml-service':'v61-ml-activation-1',
 '/api/intelligence/ml-tournament':'v55-external-ml-tournament-1',
 '/api/intelligence/trained-models':'v54-trained-sport-ml-1',
 '/api/intelligence/expert-models':'v61-expert-models-1',
 '/api/live-comeback':'v52-live-comeback-1',
 '/api/intelligence/context':'v51-context-intelligence-1',
 '/api/parlays?size=2&view=today':'v51-prediction-validation-1'
};
const degraded=new Set(['/api/intelligence/expert-models','/api/live-comeback','/api/intelligence/context','/api/parlays?size=2&view=today']);
const assertions=Object.fromEntries(('repeatedFreshPassPromotes badShadowRejected cooldownBlocks clearLeagueWinnerPromotes closeLeagueRaceHolds minimumCompetitorsRequired leagueLeaderMustConfirm repeatedCriticalQuarantines watchDoesNotQuarantine ranksWinner blocksMissingArtifact releaseIdentity activeRequiresChampion active awaitingEvidence promotesClearWinner retainsIncumbentInsideMargin blocksIneligible positiveSkill promoted councilIntegrated gameStateGuardrail').split(' ').map(key=>[key,true]));

test('full smoke suite recovers a reset and still rejects HTTP, schema and readiness failures',async()=>{
 let fault=null,resetDone=false;
 const server=createServer((req,res)=>{
  const path=req.url;
  let status=degraded.has(path)?503:200;
  let body={ok:!degraded.has(path),version:'119.0.0',ready:true,productionHardened:true,smoke:true,
   schemaVersion:schemas[path],assertions,windows:{},snapshot:{},report:{overall:{}},catalog:[],degraded:true,
   error:path==='/api/intelligence/context'?'No live or stored markets available':'No live or fresh stored sportsbook markets are available'};
  if(fault?.path===path){
   if(fault.reset&&!resetDone){resetDone=true;req.socket.destroy();return;}
   status=fault.status??status;
   body={...body,...fault.body};
  }
  res.writeHead(status,{'content-type':'application/json'});
  res.end(JSON.stringify(body));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const env={...process.env,SMOKE_VERCEL_AUTH:'0',SMOKE_BASE_URL:`http://127.0.0.1:${server.address().port}`,EXPECTED_APP_VERSION:'119.0.0'};
 const command=()=>run(process.execPath,['scripts/remote-smoke.mjs'],{env,timeout:15000});
 try{
  fault={path:'/api/intelligence/ml-tournament',reset:true};
  const success=await command();
  const report=JSON.parse(success.stdout);
  assert.equal(report.ok,true);
  assert.equal(report.results.length,31);
  assert.equal(report.results.find(x=>x.path===fault.path).attempts,2);
  assert.equal(report.results.filter(x=>x.status===503).length,4);
  for(const failure of [
   {path:'/api/intelligence/expert-models',status:401},
   {path:'/api/intelligence/expert-models',status:500},
   {path:'/api/intelligence/expert-models',status:503,body:{ok:true}},
   {path:'/api/health',status:503},
   {path:'/api/release/readiness',body:{ready:false}},
   {path:'/api/intelligence/ml-tournament',body:{schemaVersion:'wrong-schema'}}
  ]){
   fault=failure;
   await assert.rejects(command(),error=>error.code===1);
  }
 }finally{
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
 }
});
