import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const load=(path)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const opts={compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}};
const policy=ts.transpileModule(load('worker/atlas-task-scheduling.ts'),opts).outputText;
const policyUrl='data:text/javascript;base64,'+Buffer.from(policy).toString('base64');
const transitions=ts.transpileModule(load('worker/atlas-task-transitions.ts'),opts).outputText
 .replace(/from ['"]\.\/atlas-task-scheduling['"]/, 'from "'+policyUrl+'"');
const {transitionAtlasSchedule}=await import('data:text/javascript;base64,'+Buffer.from(transitions).toString('base64'));
const now=Date.parse('2026-10-20T12:00:00Z');
const iso=n=>new Date(n).toISOString();
const id='atlas-regression-00001';
const initial={id,state:'QUEUED',attempts:0,createdAt:iso(now-1000),nextRunAt:iso(now),expiresAt:iso(now+600000)};
const rows=new Map([['atlas-schedule:'+id,initial]]);
let transactions=0;
const store={transaction:async fn=>{transactions++;return fn({get:async k=>rows.get(k),put:async(k,v)=>{rows.set(k,v);}});}};
const request=(action,overrides={})=>({id,expectedState:'QUEUED',expectedAttempts:0,action,now,enabled:true,ownerAuthorized:true,providerHealthy:true,...overrides});

test('claim updates durable task and rejects stale duplicate claim',async()=>{
 const first=await transitionAtlasSchedule(store,request('CLAIM'));
 assert.equal(first.ok,true);
 assert.equal(rows.get('atlas-schedule:'+id).state,'RUNNING');
 assert.deepEqual(await transitionAtlasSchedule(store,request('CLAIM')),{ok:false,reason:'STALE_TRANSITION'});
});
test('unapproved completion and expired completion never persist',async()=>{
 const t=transactions;
 assert.deepEqual(await transitionAtlasSchedule(store,request('COMPLETE',{expectedState:'RUNNING',ownerAuthorized:false})),{ok:false,reason:'OWNER_APPROVAL_REQUIRED'});
 assert.equal(transactions,t);
 assert.deepEqual(await transitionAtlasSchedule(store,request('COMPLETE',{expectedState:'RUNNING',now:now+600001})),{ok:false,reason:'TASK_EXPIRED'});
 assert.equal(rows.get('atlas-schedule:'+id).state,'RUNNING');
});
test('authorized completion persists exactly once',async()=>{
 const result=await transitionAtlasSchedule(store,request('COMPLETE',{expectedState:'RUNNING'}));
 assert.equal(result.ok,true);
 assert.equal(rows.get('atlas-schedule:'+id).state,'COMPLETED');
 assert.deepEqual(await transitionAtlasSchedule(store,request('COMPLETE',{expectedState:'RUNNING'})),{ok:false,reason:'STALE_TRANSITION'});
});
