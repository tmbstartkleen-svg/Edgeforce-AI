import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read=(path)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
// Compile both modules and use data URLs so behavior can be checked without a Worker.
const policy=ts.transpileModule(read('worker/atlas-task-scheduling.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const purl='data:text/javascript;base64,'+Buffer.from(policy).toString('base64');
const enqueueSource=read('worker/atlas-schedule-enqueue.ts').replace(
 "import {ATLAS_MAX_AGE_MS} from './atlas-task-scheduling';",
 'const ATLAS_MAX_AGE_MS=60*60*1000;'
);
const enqueue=ts.transpileModule(enqueueSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {enqueueAtlasSchedule}=await import('data:text/javascript;base64,'+Buffer.from(enqueue).toString('base64'));
const now=Date.parse('2026-10-20T12:00:00Z');
const iso=(n)=>new Date(n).toISOString();
const data={id:'atlas-test-task-001',createdAt:iso(now),nextRunAt:iso(now+1000),expiresAt:iso(now+300000)};
const guards={enabled:true,ownerAuthorized:true,now};
const rows=new Map();
const store={transaction:async fn=>fn({get:async k=>rows.get(k),put:async(k,v)=>{rows.set(k,v);}})};

test('enqueue requires authorization and explicit enablement',async()=>{
 assert.equal((await enqueueAtlasSchedule(store,data,{...guards,enabled:false})).reason,'SCHEDULER_DISABLED');
 assert.equal((await enqueueAtlasSchedule(store,data,{...guards,ownerAuthorized:false})).reason,'OWNER_APPROVAL_REQUIRED');
 assert.equal(rows.size,0);
});
test('enqueue persists exactly once, blocks replay and rejects excessive window',async()=>{
 assert.deepEqual(await enqueueAtlasSchedule(store,data,guards),{ok:true,reason:'QUEUED'});
 assert.equal(rows.get('atlas-schedule:'+data.id).state,'QUEUED');
 assert.equal(rows.get('atlas-schedule:'+data.id).attempts,0);
 assert.equal((await enqueueAtlasSchedule(store,data,guards)).reason,'DUPLICATE_TASK');
 assert.equal(rows.size,1);
 assert.equal((await enqueueAtlasSchedule(store,{...data,id:'atlas-test-task-002',expiresAt:iso(now+7200000)},guards)).reason,'INVALID_TASK_WINDOW');
});
