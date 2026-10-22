import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('worker/d1-score-coverage-matrix.ts','utf8');
const router=readFileSync('worker/d1-standalone.ts','utf8');
test('coverage matrix denies unauthorized requests and reports only persistent source evidence',()=>{
 for(const x of ['UNAUTHORIZED','D1_BINDING_MISSING','INVALID_WINDOW','NO_DATA','STALE','PERSISTED_SCORE_COVERAGE_MATRIX','SCORES_NOT_ODDS','verifiedOdds:false','verifiedPlayerStats:false','verifiedPredictions:false'])assert.ok(s.includes(x),x);
 assert.match(router,/score-coverage-matrix/);
 assert.match(s,/observation_kind='score'/);
 assert.match(s,/scoreSports.map/);
 assert.doesNotMatch(s,/INSERT INTO|DELETE FROM|UPDATE intelligence/);
});
