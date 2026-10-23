import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const plan=readFileSync('worker/d1-score-polling-plan.ts','utf8');
const worker=readFileSync('worker/d1-standalone.ts','utf8');
test('polling planner is authenticated and read only',()=>{
 assert.match(plan,/request\.method!=='GET'/);
 assert.match(plan,/UNAUTHORIZED/);
 assert.match(plan,/D1_BINDING_MISSING/);
 assert.match(plan,/READ_ONLY_POLLING_PLAN/);
 assert.match(plan,/executionEnabled:false,executedRequests:0,performedWrites:0/);
 assert.doesNotMatch(plan,/(INSERT|UPDATE|DELETE|await fetch\()/);
 assert.match(worker,/score-polling-plan/);
});
test('planner covers every registered score source with conservative cadence',()=>{
 assert.match(plan,/scoreSports\.map/);
 assert.match(plan,/scoreboardSource\(sport\.id\)/);
 assert.match(plan,/row\?\.enabled===1&&row\.upstream_id===source\.upstreamId/);
 assert.match(plan,/SCORES_NOT_ODDS/);
 assert.match(plan,/pagesCertified:false,continuousIngestionCertified:false/);
});

test('polling plan distinguishes target freshness from actual hourly cohort cadence',()=>{
 assert.match(plan,/targetCadenceMinutes/);
 assert.match(plan,/estimatedCadenceMinutes:60/);
 assert.match(plan,/dispatchCadenceMinutes:15,cohortCount:4,estimatedPerSourceCadenceMinutes:60/);
});
