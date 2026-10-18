import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../worker/d1-multi-sport-collector.ts',import.meta.url),'utf8');
const conf=JSON.parse(readFileSync(new URL('../wrangler.d1-pilot.jsonc',import.meta.url),'utf8'));
test('score and schedule ingestion remains opt-in and source registered',()=>{
 assert.equal(conf.vars.SPORTS_SCORE_COLLECT_ENABLED,'false');
 assert.match(src,/SOURCE_NOT_APPROVED/);assert.match(src,/COLLECTION_DISABLED/);
 assert.match(src,/assessIngestEvidence\(/);
 assert.ok(src.indexOf('assessIngestEvidence(')<src.indexOf('appendD1Observations('));
});
test('future fixtures are not represented as actual scores',()=>{
 assert.match(src,/STATUS_SCHEDULED/);
 assert.match(src,/recordType:hasScores\?'SCORE':'SCHEDULE'/);
 assert.match(src,/score:hasScores\?x.score:null/);
 assert.match(src,/qualityRejected/);
});
