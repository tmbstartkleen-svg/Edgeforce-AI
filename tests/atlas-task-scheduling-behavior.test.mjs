import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Execute compiled production policy, not just regex checks over source text.
const source=fs.readFileSync(new URL('../worker/atlas-task-scheduling.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const policy=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const now=Date.parse('2026-10-20T12:00:00.000Z');
const time=(n)=>new Date(n).toISOString();
const task=(overrides={})=>({
 id:'test-01',state:'QUEUED',attempts:0,
 createdAt:time(now-1000),nextRunAt:time(now),expiresAt:time(now+1800000),
 ...overrides
});
const gates={enabled:true,ownerAuthorized:true,providerHealthy:true,now};

test('disabled, unauthorized or unhealthy providers cannot dispatch',()=>{
 assert.equal(policy.canDispatchAtlasTask(task(),{...gates,enabled:false}).reason,'SCHEDULER_DISABLED');
 assert.equal(policy.canDispatchAtlasTask(task(),{...gates,ownerAuthorized:false}).reason,'OWNER_APPROVAL_REQUIRED');
 assert.equal(policy.canDispatchAtlasTask(task(),{...gates,providerHealthy:false}).reason,'PROVIDER_UNHEALTHY');
 assert.equal(policy.canDispatchAtlasTask(task(),gates).ready,true);
});
test('due time, expiry, age cap, attempts and terminal states are enforced',()=>{
 assert.equal(policy.canDispatchAtlasTask(task({nextRunAt:time(now+1000)}),gates).reason,'NOT_DUE');
 assert.equal(policy.canDispatchAtlasTask(task({expiresAt:time(now)}),gates).reason,'TASK_EXPIRED');
 assert.equal(policy.canDispatchAtlasTask(task({expiresAt:time(now+7200000)}),gates).reason,'INVALID_TASK_WINDOW');
 assert.equal(policy.canDispatchAtlasTask(task({attempts:3}),gates).reason,'ATTEMPT_LIMIT');
 assert.equal(policy.canDispatchAtlasTask(task({state:'CANCELLED'}),gates).reason,'NOT_DISPATCHABLE');
});
test('claim, complete and cancellation are explicit and fail closed',()=>{
 const claimed=policy.claimAtlasTask(task(),gates);
 assert.equal(claimed.state,'RUNNING');
 assert.equal(policy.completeAtlasTask(claimed).state,'COMPLETED');
 assert.throws(()=>policy.completeAtlasTask(task()),/COMPLETE_REQUIRES_RUNNING/);
 assert.equal(policy.cancelAtlasTask(claimed).state,'CANCELLED');
 assert.throws(()=>policy.cancelAtlasTask(policy.cancelAtlasTask(claimed)),/TASK_ALREADY_TERMINAL/);
});
test('bounded retries stop after third attempt and before expiry',()=>{
 const running=policy.claimAtlasTask(task(),gates);
 const first=policy.nextAtlasRetry(running,now,'transient');
 assert.equal(first.state,'RETRY_WAIT');
 assert.equal(first.attempts,1);
 assert.equal(Date.parse(first.nextRunAt)-now,60000);
 assert.equal(policy.canDispatchAtlasTask(first,gates).reason,'NOT_DUE');
 const second=policy.nextAtlasRetry({...first,state:'RUNNING'},now+60000,'again');
 assert.equal(second.state,'RETRY_WAIT');
 assert.equal(second.attempts,2);
 const third=policy.nextAtlasRetry({...second,state:'RUNNING'},now+360000,'again');
 assert.equal(third.state,'FAILED');
 assert.equal(third.attempts,3);
 const expiresSoon=policy.nextAtlasRetry({...running,expiresAt:time(now+10000)},now,'timeout');
 assert.equal(expiresSoon.state,'FAILED');
});
test('health reports state counts and expired tasks',()=>{
 const states=['QUEUED','RUNNING','RETRY_WAIT','COMPLETED','FAILED','CANCELLED'];
 const result=policy.atlasScheduleHealth([...states.map(state=>task({state})),task({expiresAt:time(now-1)})],now);
 assert.deepEqual(result,{queued:1,running:1,retryWait:1,completed:1,failed:1,cancelled:1,expired:1});
});
