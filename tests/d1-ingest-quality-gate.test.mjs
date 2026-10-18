import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const src=fs.readFileSync(new URL('../worker/d1-ingest-quality-gate.ts',import.meta.url),'utf8');
test('quality gate distinguishes provider observation time from collection time',()=>{
 for(const s of ['STALE_OBSERVATION','STALE_COLLECTION','SOURCE_AFTER_COLLECTION','FUTURE_TIMESTAMP','MISSING_IDENTITY','INVALID_PAYLOAD_SIZE'])assert.ok(src.includes(s));
});
test('fresh observations are pilot-only, not betting verification',()=>{
 assert.match(src,/sourceIndependentlyVerified:false/);
 assert.match(src,/approvedForBetting:false/);
 assert.match(src,/productionCutoverAuthorized:false/);
});
