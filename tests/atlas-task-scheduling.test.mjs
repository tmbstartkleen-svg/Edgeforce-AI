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
