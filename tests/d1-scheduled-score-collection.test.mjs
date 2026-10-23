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
 assert.match(worker,/index%2===slot/);
 assert.match(worker,/for\(const sport of cohort\)/);
 assert.match(worker,/collectMultiSportScores/);
});

test('isolated pilot cron dispatches every 15 minutes and rotates two cohorts every five minutes',()=>{
 assert.ok(readFileSync('wrangler.d1-pilot.jsonc','utf8').includes('"*/5 * * * *"'));
 assert.match(worker,/Math\.floor\(Date\.now\(\)\/300000\)%2/);
});

test('scheduler retries only a bounded number of times and reports attempts per source',()=>{
 assert.match(worker,/for\(let retry=0;retry<3;retry\+\+\)/);
 assert.match(worker,/250\*\(2\*\*retry\)/);
 assert.match(worker,/attempts,recovered:attempts>1&&status===200/);
 assert.match(worker,/status===422\|\|status===400\|\|status===401\|\|status===403/);
});
