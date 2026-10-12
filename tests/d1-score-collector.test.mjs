import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const handler=readFileSync('worker/d1-nfl-score-collector.ts','utf8');
const cfg=JSON.parse(readFileSync('wrangler.d1-pilot.jsonc','utf8'));
test('real NFL scoreboard collector is disabled until licensed source approval',()=>{
 assert.equal(cfg.vars.SPORTS_SCORE_COLLECT_ENABLED,'false');
 assert.match(handler,/COLLECTION_DISABLED/);
 assert.match(handler,/SOURCE_NOT_APPROVED/);
 assert.match(handler,/appendD1Observations/);
 assert.match(handler,/upstreamOddsProvider:false/);
 assert.match(handler,/AbortSignal\.timeout\(6500\)/);
});
