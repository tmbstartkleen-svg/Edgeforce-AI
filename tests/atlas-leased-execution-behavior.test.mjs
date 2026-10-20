import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=(name)=>ts.transpileModule(fs.readFileSync(new URL('../worker/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=(s)=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const policyUrl=uri(compile('atlas-task-scheduling'));
const leaseUrl=uri(compile('atlas-execution-lease'));
const leasedSource=compile('atlas-leased-execution').replaceAll("from './atlas-task-scheduling'",'from '+JSON.stringify(policyUrl)).replaceAll("from './atlas-execution-lease'",'from '+JSON.stringify(leaseUrl));
const operations=await import(uri(leasedSource));
const now=Date.parse('2026-10-20T12:00:00.000Z');
const id='durable-task-001',token='abcdefghijklmnopqrstuvwxyzABCDEF';
const record={id,state:'QUEUED',attempts:0,createdAt:new Date(now-1000).toISOString(),nextRunAt:new Date(now).toISOString(),expiresAt:new Date(now+300000).toISOString()};
const setup=()=>{const data=new Map([['atlas-schedule:'+id,structuredClone(record)]]);const storage={transaction:async fn=>fn({get:async key=>data.get(key),put:async(key,value)=>{data.set(key,value);}})};return {data,storage};};
const args={id,expectedState:'QUEUED',expectedAttempts:0,token,now,durationMs:10000,enabled:true,ownerAuthorized:true,providerHealthy:true};
test('durable claim and completion enforce fencing and single-use completion',async()=>{
 const {data,storage}=setup();
 const first=await operations.claimAtlasScheduledExecution(storage,args);
 assert.equal(first.ok,true);
 assert.equal(first.lease.epoch,1);
 assert.equal(data.get('atlas-schedule:'+id).state,'RUNNING');
 assert.equal((await operations.claimAtlasScheduledExecution(storage,args)).reason,'STALE_TRANSITION');
 assert.equal((await operations.completeAtlasLeasedExecution(storage,{...args,epoch:2})).reason,'STALE_EXECUTOR');
 assert.equal((await operations.completeAtlasLeasedExecution(storage,{...args,epoch:1,now:now+10000})).reason,'LEASE_EXPIRED');
 assert.equal((await operations.completeAtlasLeasedExecution(storage,{...args,epoch:1,now:now+1000})).ok,true);
 assert.equal(data.get('atlas-schedule:'+id).state,'COMPLETED');
 assert.equal((await operations.completeAtlasLeasedExecution(storage,{...args,epoch:1,now:now+1500})).reason,'TASK_NOT_RUNNING');
});
test('disabled, unauthorized and unhealthy gates cannot claim work',async()=>{
 const {data,storage}=setup();
 for(const [key,reason] of [['enabled','SCHEDULER_DISABLED'],['ownerAuthorized','OWNER_APPROVAL_REQUIRED'],['providerHealthy','PROVIDER_UNHEALTHY']]){
  assert.equal((await operations.claimAtlasScheduledExecution(storage,{...args,[key]:false})).reason,reason);
 }
 assert.equal(data.get('atlas-schedule:'+id).state,'QUEUED');
 assert.equal(data.has('atlas-lease:'+id),false);
});

test('execution lease never outlives its scheduled task',async()=>{
 const {data,storage}=setup();
 const result=await operations.claimAtlasScheduledExecution(storage,{...args,durationMs:60000,now:now+250000});
 assert.equal(result.reason,'LEASE_OUTLIVES_TASK');
 assert.equal(data.get('atlas-schedule:'+id).state,'QUEUED');
 assert.equal(data.has('atlas-lease:'+id),false);
});
test('persisted lease cannot be overtaken even if task is queued again',async()=>{
 const {data,storage}=setup();
 const first=await operations.claimAtlasScheduledExecution(storage,args);
 assert.equal(first.ok,true);
 data.set('atlas-schedule:'+id,structuredClone(record));
 const duplicate=await operations.claimAtlasScheduledExecution(storage,{...args,token:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef'});
 assert.equal(duplicate.reason,'LEASE_ALREADY_EXISTS');
 assert.equal(data.get('atlas-lease:'+id).token,token);
});
