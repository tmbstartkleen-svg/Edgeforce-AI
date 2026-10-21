import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const raw=fs.readFileSync(new URL('../worker/atlas-mission-gateway.ts',import.meta.url),'utf8');
const code=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {atlasGateway}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const secret='owner-test-secret-abcdefghijklmnopqrstuvwxyz';
const seen=[];
const env={EDGEFORCE_NETWORK_OWNER_TOKEN:secret,ATLAS_MISSION_ROOM:{
 idFromName:name=>name,get:()=>({fetch:async request=>{seen.push(request);return Response.json({ok:true,task:{id:'scheduled-task-001',state:'QUEUED'}});}})
}};
const request=(method,path,auth=true,body)=>new Request('https://edgeforce.example'+path,{method,headers:{...(auth?{authorization:'Bearer '+secret}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
const forward=async()=>Response.json({ok:true});
test('owner auth is required before private task inspection',async()=>{
 seen.length=0;
 const unauth=await atlasGateway(request('GET','/api/network/schedule/task?id=scheduled-task-001',false),env,forward);
 assert.equal(unauth.status,401);
 assert.equal(seen.length,0);
 const ok=await atlasGateway(request('GET','/api/network/schedule/task?id=scheduled-task-001'),env,forward);
 assert.equal(ok.status,200);
 assert.equal(seen.length,1);
 assert.equal(new URL(seen[0].url).hostname,'atlas.internal');
});
test('scheduler mutations stay blocked, even for authorized owner',async()=>{
 seen.length=0;
 const reply=await atlasGateway(request('POST','/api/network/schedule/lifecycle',true,{enabled:true,ownerAuthorized:true}),env,forward);
 assert.equal(reply.status,403);
 assert.equal((await reply.json()).error,'SCHEDULER_DISABLED');
 assert.equal(seen.length,0);
});
test('scheduler task inspection rejects unsafe ids and non-GET methods',async()=>{
 seen.length=0;
 assert.equal((await atlasGateway(request('GET','/api/network/schedule/task?id=../bad'),env,forward)).status,400);
 assert.equal((await atlasGateway(request('POST','/api/network/schedule/task',true,{id:'scheduled-task-001'}),env,forward)).status,405);
 assert.equal(seen.length,0);
});

test('cancellation uses owner-authenticated forwarding and never accepts spoofed authority',async()=>{
 seen.length=0;
 const body={id:'scheduled-task-001',expectedState:'QUEUED',expectedAttempts:0,ownerAuthorized:false,enabled:true};
 const noAuth=await atlasGateway(request('POST','/api/network/schedule/cancel',false,body),env,forward);
 assert.equal(noAuth.status,401);
 assert.equal(seen.length,0);
 const ok=await atlasGateway(request('POST','/api/network/schedule/cancel',true,body),env,forward);
 assert.equal(ok.status,200);
 assert.equal(seen.length,1);
 const forwarded=await seen[0].json();
 assert.deepEqual(forwarded,{id:body.id,expectedState:body.expectedState,expectedAttempts:0});
});

test('director GET does not bypass Founder authentication',async()=>{
 const unauth=await atlasGateway(request('GET','/api/network/director',false),env,forward);
 assert.equal(unauth.status,401);
 const auth=await atlasGateway(request('GET','/api/network/director'),env,forward);
 assert.equal(auth.status,200);
});

test('director GET supports only authenticated safe methods',async()=>{
 assert.equal((await atlasGateway(request('PUT','/api/network/director'),env,forward)).status,405);
 assert.equal((await atlasGateway(request('DELETE','/api/network/director'),env,forward)).status,405);
 assert.equal((await atlasGateway(request('GET','/api/network/director',false),env,forward)).status,401);
 assert.equal((await atlasGateway(request('GET','/api/network/director'),env,forward)).status,200);
});

test('manual enqueue requires owner token and strips caller activation flags',async()=>{
 seen.length=0;
 const body={id:'scheduled-task-001',createdAt:'2026-10-20T12:00:00Z',nextRunAt:'2026-10-20T12:01:00Z',expiresAt:'2026-10-20T12:20:00Z',question:'Analyze the soccer fixtures',enabled:true,ownerAuthorized:true};
 assert.equal((await atlasGateway(request('POST','/api/network/schedule/enqueue',false,body),env,forward)).status,401);
 assert.equal(seen.length,0);
 const forged=await atlasGateway(request('POST','/api/network/schedule/enqueue',true,body),env,forward);
 assert.equal(forged.status,400);
 assert.equal((await forged.json()).error,'UNEXPECTED_TASK_FIELD');
 assert.equal(seen.length,0);
 const {enabled,ownerAuthorized,...valid}=body;
 const response=await atlasGateway(request('POST','/api/network/schedule/enqueue',true,valid),env,forward);
 assert.equal(response.status,200);
 assert.equal(seen.length,1);
 assert.deepEqual(await seen[0].json(),valid);
});

test('recovery requires Founder authentication and refuses spoofed permissions',async()=>{
 seen.length=0;
 const valid={id:'scheduled-task-001',expectedAttempts:0};
 assert.equal((await atlasGateway(request('POST','/api/network/schedule/recover',false,valid),env,forward)).status,401);
 assert.equal(seen.length,0);
 const forged=await atlasGateway(request('POST','/api/network/schedule/recover',true,{...valid,ownerAuthorized:true}),env,forward);
 assert.equal(forged.status,400);assert.equal(seen.length,0);
 const reply=await atlasGateway(request('POST','/api/network/schedule/recover',true,valid),env,forward);
 assert.equal(reply.status,200);assert.equal(seen.length,1);
 assert.deepEqual(await seen[0].json(),valid);
 assert.equal(new URL(seen[0].url).pathname,'/schedule/recover');
});

test('mismatched director report finalizes the durable task as failed',async()=>{
 seen.length=0;
 const reply=await atlasGateway(request('POST','/api/network/director',true,{question:'Verify latest soccer fixtures'}),env,
  async()=>Response.json({ok:true,question:'Different question'}));
 assert.equal(reply.status,503);
 assert.equal((await reply.json()).error,'INVALID_DIRECTOR_REPORT');
 const endpoints=seen.map(item=>new URL(item.url).pathname);
 assert.ok(endpoints.includes('/tasks/start'));
 assert.ok(endpoints.includes('/tasks/finish'));
 const finish=seen.find(item=>new URL(item.url).pathname==='/tasks/finish');
 assert.equal((await finish.json()).status,'FAILED');
});

test('director finalization failure is reported without pretending invalid response handled',async()=>{
 const failingRoom={...env,ATLAS_MISSION_ROOM:{
  idFromName:name=>name,get:()=>({fetch:async req=>{
   const route=new URL(req.url).pathname;
   if(route==='/tasks/finish')return Response.json({ok:false}, {status:503});
   return Response.json({ok:true});
  }})
 }};
 const result=await atlasGateway(request('POST','/api/network/director',true,{question:'Analyze the next soccer schedule'}),failingRoom,
  async()=>Response.json({ok:true,question:'Wrong question'}));
 assert.equal(result.status,503);
 assert.equal((await result.json()).error,'DIRECTOR_TASK_FINALIZATION_FAILED');
});
