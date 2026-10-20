import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=n=>ts.transpileModule(fs.readFileSync(new URL('../worker/'+n+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const policy=uri(compile('atlas-task-scheduling')),lease=uri(compile('atlas-execution-lease'));
const leased=uri(compile('atlas-leased-execution').replaceAll("from './atlas-task-scheduling'","from "+JSON.stringify(policy)).replaceAll("from './atlas-execution-lease'","from "+JSON.stringify(lease)));
const source=compile('atlas-execution-coordinator').replaceAll("from './atlas-leased-execution'","from "+JSON.stringify(leased));
const {runAtlasScheduledTask}=await import(uri(source));
const now=Date.parse('2026-10-20T12:00:00.000Z'),id='coordinator-task-001';
const args={id,expectedState:'QUEUED',expectedAttempts:0,token:'abcdefghijklmnopqrstuvwxyzABCDEF',now,durationMs:10000,enabled:true,ownerAuthorized:true,providerHealthy:true,clock:()=>now+1000};
const setup=()=>{const data=new Map([['atlas-schedule:'+id,{id,state:'QUEUED',attempts:0,createdAt:new Date(now-1000).toISOString(),nextRunAt:new Date(now).toISOString(),expiresAt:new Date(now+300000).toISOString()}]]);return {data,store:{transaction:async fn=>fn({get:async k=>data.get(k),put:async(k,v)=>{data.set(k,v);}})}};};
test('private coordinator executes only after authorized claim and finishes once',async()=>{
 const {data,store}=setup();let calls=0;
 const run=await runAtlasScheduledTask(store,{...args,execute:async()=>{calls++;return {ok:true};}});
 assert.equal(run.ok,true);assert.equal(calls,1);
 assert.equal(data.get('atlas-schedule:'+id).state,'COMPLETED');
 const replay=await runAtlasScheduledTask(store,{...args,execute:async()=>{calls++;return {ok:true};}});
 assert.equal(replay.stage,'claim');assert.equal(calls,1);
});
test('disabled or unauthorized execution never calls provider',async()=>{
 for(const gate of ['enabled','ownerAuthorized','providerHealthy']){
  const {data,store}=setup();let calls=0;
  const run=await runAtlasScheduledTask(store,{...args,[gate]:false,execute:async()=>{calls++;return {ok:true};}});
  assert.equal(run.stage,'claim');assert.equal(calls,0);assert.equal(data.get('atlas-schedule:'+id).state,'QUEUED');
 }
});
test('failed execution cannot be recorded as completed',async()=>{
 const {data,store}=setup();
 const run=await runAtlasScheduledTask(store,{...args,execute:async()=>({ok:false,reason:'UPSTREAM_FAILED'})});
 assert.equal(run.stage,'execute');assert.equal(data.get('atlas-schedule:'+id).state,'RUNNING');
});

test('thrown provider error leaves running task uncompleted for manual recovery',async()=>{
 const {data,store}=setup();
 const run=await runAtlasScheduledTask(store,{...args,execute:async()=>{throw new Error('secret provider failure');}});
 assert.deepEqual(run,{ok:false,stage:'execute',reason:'EXECUTION_FAILED'});
 assert.equal(data.get('atlas-schedule:'+id).state,'RUNNING');
});
test('stale completion is fenced even after successful task callback',async()=>{
 const {data,store}=setup();let calls=0;
 const run=await runAtlasScheduledTask(store,{...args,clock:()=>now+11000,execute:async()=>{calls++;return {ok:true};}});
 assert.equal(run.ok,false);assert.equal(run.stage,'complete');assert.equal(run.reason,'LEASE_EXPIRED');
 assert.equal(calls,1);assert.equal(data.get('atlas-schedule:'+id).state,'RUNNING');
});

test('clock failure cannot mark completed after a provider callback',async()=>{
 for(const clock of [()=>{throw Error('clock failed');},()=>Number.NaN]){
  const {data,store}=setup();
  const result=await runAtlasScheduledTask(store,{...args,clock,execute:async()=>({ok:true})});
  assert.equal(result.ok,false);assert.equal(result.stage,'complete');
  assert.equal(data.get('atlas-schedule:'+id).state,'RUNNING');
 }
});
