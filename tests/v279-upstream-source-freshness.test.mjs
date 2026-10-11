import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/app/api/operations/intelligence-core/readiness/route.ts',import.meta.url),'utf8');
test('live readiness uses upstream observed_at rather than arrival time',()=>{
 assert.match(src,/max\(observed_at\) as latest/);
 assert.match(src,/max\(ingested_at\) as last_ingested/);
 assert.match(src,/latestObservationMs:observations\[0\]\?\.latest/);
 assert.match(src,/latestIngestion:observations\[0\]\?\.last_ingested/);
});
