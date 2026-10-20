import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=n=>ts.transpileModule(fs.readFileSync(new URL('../worker/'+n+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const policy=uri(compile('atlas-task-scheduling'));
const lease=uri(compile('atlas-execution-lease'));
const leased=uri(compile('atlas-leased-execution').replaceAll("from './atlas-task-scheduling'","from "+JSON.stringify(policy)).replaceAll("from './atlas-execution-lease'","from "+JSON.stringify(lease)));
const leasedOps=await import(leased);
const enqueue=await import(uri(compile('atlas-schedule-enqueue').replaceAll("from './atlas-task-scheduling'","from "+JSON.stringify(policy))));
const coordinator=await import(uri(compile('atlas-execution-coordinator').replaceAll("from './atlas-leased-execution'","from "+JSON.stringify(leased))));
const recovery=await import(uri(compile('atlas-interrupted-recovery')));
const now=Date.parse('2026-10-20T12:00:00Z');
const id='full-lifecycle-001';
const input={id,createdAt:new Date(now-1000).toISOString(),nextRunAt:new Date(now).toISOString(),expiresAt:new Date(now+120000).toISOString()};
const token='abcdefghijklmnopqrstuvwxyzABCDEF';
function fixture(){
 const data=new Map();
 const storage={transaction:async fn=>fn({get:async key=>data.get(key),put:async(key,value)=>{data.set(key,value);}})};
 return {data,storage};
}
const runArgs={id,expectedState:'QUEUED',expectedAttempts:0,token,now,durationMs:10000,enabled:true,ownerAuthorized:true,providerHealthy:true,clock:()=>now+1000};
test('durable enqueue, execution, completion and replay rejection form one lifecycle',async()=>{
 const {data,storage}=fixture();
 assert.equal((await enqueue.enqueueAtlasSchedule(storage,input,{enabled:true,ownerAuthorized:true,now})).ok,true);
 assert.equal((await enqueue.enqueueAtlasSchedule(storage,input,{enabled:true,ownerAuthorized:true,now})).reason,'DUPLICATE_TASK');
 let calls=0;
 assert.equal((await coordinator.runAtlasScheduledTask(storage,{...runArgs,execute:async()=>{calls++;return {ok:true};}})).ok,true);
 assert.equal(data.get('atlas-schedule:'+id).state,'COMPLETED');
 assert.equal((await coordinator.runAtlasScheduledTask(storage,{...runArgs,execute:async()=>{calls++;return {ok:true};}})).stage,'claim');
 assert.equal(calls,1);
});
test('failed side effect needs expired lease and Founder review, never automatic retry',async()=>{
 const {data,storage}=fixture();
 await enqueue.enqueueAtlasSchedule(storage,input,{enabled:true,ownerAuthorized:true,now});
 const result=await coordinator.runAtlasScheduledTask(storage,{...runArgs,execute:async()=>({ok:false,reason:'PROVIDER_FAILED'})});
 assert.equal(result.stage,'execute');
 assert.equal(data.get('atlas-schedule:'+id).state,'RUNNING');
 assert.equal((await recovery.failInterruptedAtlasTask(storage,{id,expectedAttempts:0,now:now+5000,ownerAuthorized:true})).reason,'LEASE_STILL_ACTIVE');
 assert.equal((await recovery.failInterruptedAtlasTask(storage,{id,expectedAttempts:0,now:now+11000,ownerAuthorized:true})).ok,true);
 assert.equal(data.get('atlas-schedule:'+id).state,'FAILED');
 assert.equal((await coordinator.runAtlasScheduledTask(storage,{...runArgs,execute:async()=>({ok:true})})).stage,'claim');
});

test('Founder cancellation blocks queued work before any provider call',async()=>{
 const {data,storage}=fixture();
 await enqueue.enqueueAtlasSchedule(storage,input,{enabled:true,ownerAuthorized:true,now});
 assert.equal((await leasedOps.cancelAtlasLeasedExecution(storage,{id,expectedState:'QUEUED',expectedAttempts:0,ownerAuthorized:true})).ok,true);
 let calls=0;
 const result=await coordinator.runAtlasScheduledTask(storage,{...runArgs,execute:async()=>{calls++;return {ok:true};}});
 assert.equal(result.stage,'claim');assert.equal(calls,0);
 assert.equal(data.get('atlas-schedule:'+id).state,'CANCELLED');
});
test('cancellation fences already claimed work against late completion',async()=>{
 const {data,storage}=fixture();
 await enqueue.enqueueAtlasSchedule(storage,input,{enabled:true,ownerAuthorized:true,now});
 const claim=await leasedOps.claimAtlasScheduledExecution(storage,runArgs);
 assert.equal(claim.ok,true);
 assert.equal((await leasedOps.cancelAtlasLeasedExecution(storage,{id,expectedState:'RUNNING',expectedAttempts:0,ownerAuthorized:true})).ok,true);
 const result=await leasedOps.completeAtlasLeasedExecution(storage,{id,token,epoch:claim.lease.epoch,now:now+1000,enabled:true,ownerAuthorized:true,providerHealthy:true});
 assert.equal(result.reason,'TASK_NOT_RUNNING');
 assert.equal(data.get('atlas-schedule:'+id).state,'CANCELLED');
});
