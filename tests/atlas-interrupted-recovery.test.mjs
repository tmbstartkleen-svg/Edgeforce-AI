import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const src=fs.readFileSync(new URL('../worker/atlas-interrupted-recovery.ts',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {failInterruptedAtlasTask}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const id='interrupted-task-001',now=20000;
function fixture(){const data=new Map([
 ['atlas-schedule:'+id,{id,state:'RUNNING',attempts:0,createdAt:'2026-10-20T12:00:00Z',nextRunAt:'2026-10-20T12:00:00Z',expiresAt:'2026-10-20T12:30:00Z'}],
 ['atlas-lease:'+id,{taskId:id,token:'abcdefghijklmnopqrstuvwxyzABCDEF',epoch:1,acquiredAt:1000,expiresAt:11000}],
 ['atlas-lease-epoch:'+id,1]
 ]);return {data,storage:{transaction:async fn=>fn({get:async k=>data.get(k),put:async(k,v)=>{data.set(k,v);}})}};}
const args={id,expectedAttempts:0,now,ownerAuthorized:true};
test('founder may terminally fail expired leased task, preserving fencing tombstone',async()=>{
 const {data,storage}=fixture();
 assert.deepEqual(await failInterruptedAtlasTask(storage,args),{ok:true});
 assert.equal(data.get('atlas-schedule:'+id).state,'FAILED');
 assert.equal(data.get('atlas-lease-epoch:'+id),1);
 assert.equal(data.get('atlas-lease:'+id).epoch,1);
 assert.equal((await failInterruptedAtlasTask(storage,args)).reason,'STALE_TRANSITION');
});
test('cannot recover before expiry or without owner authorization',async()=>{
 const {data,storage}=fixture();
 assert.equal((await failInterruptedAtlasTask(storage,{...args,now:5000})).reason,'LEASE_STILL_ACTIVE');
 assert.equal((await failInterruptedAtlasTask(storage,{...args,ownerAuthorized:false})).reason,'OWNER_APPROVAL_REQUIRED');
 assert.equal(data.get('atlas-schedule:'+id).state,'RUNNING');
});
test('recovery fails closed on missing or corrupted fence',async()=>{
 const {data,storage}=fixture();data.delete('atlas-lease-epoch:'+id);
 assert.equal((await failInterruptedAtlasTask(storage,args)).reason,'LEASE_INTEGRITY_FAILURE');
 assert.equal(data.get('atlas-schedule:'+id).state,'RUNNING');
});

test('malformed persisted lease window cannot be used to terminally recover',async()=>{
 const {data,storage}=fixture();
 const lease=data.get('atlas-lease:'+id);
 data.set('atlas-lease:'+id,{...lease,acquiredAt:lease.expiresAt+1});
 assert.equal((await failInterruptedAtlasTask(storage,args)).reason,'LEASE_INTEGRITY_FAILURE');
 assert.equal(data.get('atlas-schedule:'+id).state,'RUNNING');
});
