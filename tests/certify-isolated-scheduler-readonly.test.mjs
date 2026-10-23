import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync('scripts/certify-isolated-scheduler-readonly.mjs','utf8');
test('scheduler preflight performs only authenticated, bounded GET reads',()=>{
 assert.match(script,/ISOLATED_PILOT_ONLY/);
 assert.match(script,/AbortSignal\.timeout\(15000\)/);
 assert.match(script,/score-collector-readiness/);
 assert.match(script,/score-polling-plan/);
 assert.match(script,/score-scheduler-receipts\?limit=40/);
 assert.doesNotMatch(script,/method:\s*['"]POST['"]|wrangler deploy|wrangler d1 execute/);
});
test('scheduler preflight checks all switches stay disabled and receipts stay read only',()=>{
 assert.match(script,/readiness\.approved!==16/);
 assert.match(script,/plan\.executionEnabled!==false/);
 assert.match(script,/receipts\.collectionTriggered!==false/);
 assert.match(script,/FLAGS_CHANGED_DURING_READ_ONLY_CERT/);
 assert.match(script,/CONTROLLED_ISOLATED_SCHEDULED_EXECUTION_NOT_YET_CERTIFIED/);
});
