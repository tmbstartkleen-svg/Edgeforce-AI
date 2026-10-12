import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {scoreSports,scoreboardSource} from '../src/lib/intelligence-core/score-source-catalog.mjs';
const c=readFileSync('worker/d1-multi-sport-collector.ts','utf8');
test('multi-sport D1 collector is fail closed and supports entire allowlist',()=>{
 assert.equal(scoreSports.length,8);
 for(const sport of scoreSports)assert.equal(scoreboardSource(sport.id).classification,'SCORES_NOT_ODDS');
 assert.match(c,/COLLECTION_DISABLED/);
 assert.match(c,/SOURCE_NOT_APPROVED/);
 assert.match(c,/SPORT_NOT_APPROVED/);
 assert.match(c,/appendD1Observations/);
 assert.match(c,/AbortSignal\.timeout\(6500\)/);
 assert.match(c,/competitors\.length!==2/);
});
