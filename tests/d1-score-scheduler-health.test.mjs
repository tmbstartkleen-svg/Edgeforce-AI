import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const health=readFileSync('worker/d1-score-scheduler-health.ts','utf8');
const router=readFileSync('worker/d1-standalone.ts','utf8');
test('scheduler health endpoint is authenticated and read only',()=>{
 assert.match(health,/request\.method!=='GET'/);
 assert.match(health,/UNAUTHORIZED/);
 assert.match(health,/READ_ONLY_SCHEDULER_HEALTH/);
 assert.match(health,/collectionTriggered:false,writesPerformed:0/);
 assert.match(router,/score-scheduler-health/);
 assert.doesNotMatch(health,/INSERT INTO|UPDATE score_scheduler_receipts|DELETE FROM|fetch\(/);
});
test('health endpoint reports no receipt as missing execution evidence, not source outage',()=>{
 assert.match(health,/NO_RECEIPT/);
 assert.match(health,/ageMinutes>10/);
 assert.match(health,/sourcesWithReceipts/);
 assert.match(health,/staleSources/);
 assert.match(health,/does not prove an upstream source is unavailable/);
});

test('missed-run alerts only activate after collector and scheduler opt-in',()=>{
 assert.match(health,/const monitoringActive=schedulerEnabled&&collectionEnabled/);
 assert.match(health,/missedRun:monitoringActive&&/);
 assert.match(health,/monitoringState:!monitoringActive\?'DISABLED'/);
 assert.match(health,/missedRunAlerts:sources.filter\(s=>s.missedRun\).length/);
});
