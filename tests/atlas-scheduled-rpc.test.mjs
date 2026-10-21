import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../worker/atlas-mission-gateway.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {dispatchAtlasScheduledRpc}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const secret='founder-secret-at-least-24-characters';
const input={id:'scheduled-research-001',expectedState:'QUEUED',expectedAttempts:0,durationMs:10000};
const request=(token)=>new Request('https://edgeforce.example/internal',{headers:{Authorization:'Bearer '+token}});
function environment(enabled){let calls=0;const stub={async executeTrustedScheduledResearch(data){calls++;assert.equal(data.ownerToken,secret);return {ok:true};}};return {env:{ATLAS_SCHEDULE_EXECUTION_ENABLED:enabled?'true':'false',EDGEFORCE_NETWORK_OWNER_TOKEN:secret,ATLAS_MISSION_ROOM:{idFromName:()=>1,get:()=>stub}},calls:()=>calls};}
test('default-disabled dispatcher refuses invocation',async()=>{const e=environment(false);const res=await dispatchAtlasScheduledRpc(request(secret),e.env,input);assert.equal(res.status,403);assert.equal(e.calls(),0);});
test('Founder token required before RPC dispatch',async()=>{const e=environment(true);const res=await dispatchAtlasScheduledRpc(request('wrong'),e.env,input);assert.equal(res.status,401);assert.equal(e.calls(),0);});
test('valid authorized invocation reaches Durable Object RPC exactly once',async()=>{const e=environment(true);const res=await dispatchAtlasScheduledRpc(request(secret),e.env,input);assert.equal(res.status,200);assert.equal(e.calls(),1);});
test('invalid task input never reaches RPC',async()=>{const e=environment(true);const res=await dispatchAtlasScheduledRpc(request(secret),e.env,{...input,durationMs:999999});assert.equal(res.status,400);assert.equal(e.calls(),0);});

test('missing RPC binding fails closed',async()=>{
 const e=environment(true);
 delete e.env.ATLAS_MISSION_ROOM;
 const response=await dispatchAtlasScheduledRpc(request(secret),e.env,input);
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,'ATLAS_RPC_UNAVAILABLE');
});
test('upstream RPC exceptions fail closed',async()=>{
 const e=environment(true);
 e.env.ATLAS_MISSION_ROOM={idFromName:()=>1,get:()=>({executeTrustedScheduledResearch:async()=>{throw Error('upstream unavailable');}})};
 const response=await dispatchAtlasScheduledRpc(request(secret),e.env,input);
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,'ATLAS_RPC_FAILED');
});
test('RPC responses without explicit success are never marked successful',async()=>{
 const e=environment(true);
 e.env.ATLAS_MISSION_ROOM={idFromName:()=>1,get:()=>({executeTrustedScheduledResearch:async()=>({ok:false,reason:'PROVIDER_UNHEALTHY'})})};
 const response=await dispatchAtlasScheduledRpc(request(secret),e.env,input);
 assert.equal(response.status,409);
});

test('RPC denies malformed state and negative attempts before touching Durable Object',async()=>{
 const e=environment(true);
 for(const invalid of [{...input,expectedState:'RUNNING'},{...input,expectedAttempts:-1},{...input,id:'bad'}]){
  const response=await dispatchAtlasScheduledRpc(request(secret),e.env,invalid);
  assert.equal(response.status,400);
 }
 assert.equal(e.calls(),0);
});

test('missing or malformed RPC body fails closed without a Durable Object call',async()=>{
 const e=environment(true);
 for(const bad of [null,undefined,42,'bad']){
  const response=await dispatchAtlasScheduledRpc(request(secret),e.env,bad);
  assert.equal(response.status,400);
 }
 assert.equal(e.calls(),0);
});
