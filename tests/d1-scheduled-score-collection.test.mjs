import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync('worker/d1-standalone.ts','utf8');
const config=readFileSync('wrangler.d1-pilot.jsonc','utf8');
test('scheduled score collection is explicitly disabled in pilot configuration',()=>{
 assert.match(config,/"SCHEDULED_SCORE_COLLECTION_ENABLED": "false"/);
});
test('scheduler is opt-in, fail-closed and bounded to a four-source cohort',()=>{
 assert.match(worker,/SCHEDULED_SCORE_COLLECTION_ENABLED==='true'/);
 assert.match(worker,/SPORTS_SCORE_COLLECT_ENABLED==='true'/);
 assert.match(worker,/INTELLIGENCE_D1_WRITE_ENABLED==='true'/);
 assert.match(worker,/SPORTS_D1_WRITE_ENABLED!=='true'/);
 assert.match(worker,/env\.CRON_SECRET\.length>=24/);
 assert.match(worker,/index%4===slot/);
 assert.match(worker,/for\(const sport of cohort\)/);
 assert.match(worker,/collectMultiSportScores/);
});
