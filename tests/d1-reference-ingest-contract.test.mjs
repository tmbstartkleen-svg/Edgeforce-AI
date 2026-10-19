import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const code=readFileSync('worker/d1-reference-ingest.ts','utf8');
const diagnostics=readFileSync('worker/d1-reference-ingest-status.ts','utf8');

test('D1 reference ingestion requires authorization and explicit feature enablement',()=>{
 assert.match(code,/request\.headers\.get\('authorization'\)/);
 assert.match(code,/env\.D1_REFERENCE_INGEST_ENABLED!=='true'/);
 assert.match(code,/reason:'PILOT_DISABLED'/);
});
test('D1 reference ingestion batches bounded writes transactionally',()=>{
 assert.match(code,/items\.length>25/);
 assert.match(code,/await db\.batch\(statements\)/);
 assert.doesNotMatch(code,/\.run\(\)/);
 assert.match(code,/reason:'D1_WRITE_FAILED'/);
});
test('D1 reference ingestion does not invent successful insertion counts',()=>{
 assert.match(code,/results\.length!==values\.length/);
 assert.match(code,/Number\.isInteger\(result\?\.meta\?\.changes\)/);
 assert.match(code,/D1_UNVERIFIED_WRITE_RESULT/);
 assert.match(code,/processed:values\.length,inserted,ignored:/);
});
test('D1 reference ingestion preserves source attribution and excludes cutover',()=>{
 assert.match(code,/source:e\.source,observed_at:e\.observed_at/);
 assert.match(code,/productionCutoverAuthorized:false/);
 assert.match(diagnostics,/migrationReady/);
 assert.match(diagnostics,/productionCutoverAuthorized:false/);
});
