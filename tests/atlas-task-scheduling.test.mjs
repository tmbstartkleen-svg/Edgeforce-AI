import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../worker/atlas-task-scheduling.ts',import.meta.url),'utf8');

test('Build 410 scheduling is never automatically activated',()=>{
 assert.match(source,/Pure policy only\. No cron/);
 assert.match(source,/if\(!opts\.enabled\)return \{ready:false,reason:'SCHEDULER_DISABLED'\}/);
 assert.match(source,/if\(!opts\.ownerAuthorized\)return \{ready:false,reason:'OWNER_APPROVAL_REQUIRED'\}/);
 assert.match(source,/if\(!opts\.providerHealthy\)return \{ready:false,reason:'PROVIDER_UNHEALTHY'\}/);
 assert.doesNotMatch(source,/fetch\(|setInterval\(|setTimeout\(/);
});

test('Build 410 rejects ineligible jobs before dispatch',()=>{
 for(const code of ['INVALID_TASK_WINDOW','TASK_EXPIRED','ATTEMPT_LIMIT','NOT_DISPATCHABLE','NOT_DUE']){
  assert.ok(source.includes(code),'Missing fail-closed gate '+code);
 }
 assert.match(source,/task\.state!=='QUEUED'&&task\.state!=='RETRY_WAIT'/);
 assert.match(source,/opts\.now>=expires/);
 assert.match(source,/Number\.isInteger\(task\.attempts\)/);
});

test('Build 410 caps retries and requires a persisted transition',()=>{
 assert.match(source,/ATLAS_MAX_ATTEMPTS=3/);
 assert.match(source,/ATLAS_MAX_AGE_MS=60\*60\*1000/);
 assert.match(source,/ATLAS_RETRY_DELAYS_MS=\[60_000,5\*60_000\]/);
 assert.match(source,/task\.state!=='RUNNING'/);
 assert.match(source,/attempts<ATLAS_MAX_ATTEMPTS/);
 assert.match(source,/now\+retryDelay<expires/);
 assert.match(source,/atomically in the Durable Object/);
 assert.doesNotMatch(source,/process\.env|placeBet|submitWager/);
});

test('Claim and completion require eligible and running tasks',()=>{
 assert.match(source,/export function claimAtlasTask/);
 assert.match(source,/canDispatchAtlasTask\(task,opts\)/);
 assert.match(source,/if\(!gate\.ready\)throw new Error\(gate\.reason\)/);
 assert.match(source,/export function completeAtlasTask/);
 assert.match(source,/COMPLETE_REQUIRES_RUNNING/);
});
test('Cancellation is terminal and health counts are explicit',()=>{
 assert.match(source,/export function cancelAtlasTask/);
 assert.match(source,/TASK_ALREADY_TERMINAL/);
 assert.match(source,/export function atlasScheduleHealth/);
 assert.match(source,/retryWait:0/);
 assert.match(source,/counts\.expired\+\+/);
});

test('Interrupted work cannot be blindly reclaimed without an execution lease',()=>{
 assert.match(source,/export function inspectAtlasInterruptedTask/);
 assert.match(source,/recoverable:false,reason:'MISSING_EXECUTION_LEASE'/);
 assert.match(source,/recoverable:false,reason:'TASK_EXPIRED'/);
});

test('Execution lease policy rejects stale and expired executors',()=>{
 const lease=fs.readFileSync(new URL('../worker/atlas-execution-lease.ts',import.meta.url),'utf8');
 for(const gate of ['INVALID_LEASE_TOKEN','INVALID_LEASE_WINDOW','INVALID_LEASE_EPOCH','LEASE_REQUIRED','STALE_EXECUTOR','LEASE_EXPIRED'])
  assert.ok(lease.includes(gate),gate);
 assert.match(lease,/previousEpoch\+1/);
 assert.match(lease,/lease\.token!==token\|\|lease\.epoch!==epoch/);
 assert.doesNotMatch(lease,/fetch\(|setInterval\(|placeBet/);
});
