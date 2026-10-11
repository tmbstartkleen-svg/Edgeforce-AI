import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/lib/intelligence-core/live-odds-adapter.ts',import.meta.url),'utf8');
test('mirroring is opt-in and rejects stored or demo sources',()=>{
 assert.match(src,/INTELLIGENCE_WAREHOUSE_MIRROR_ENABLED/);
 assert.match(src,/batch.source!=='live'/);
});
test('observations require event and provenance timestamps',()=>{
 assert.match(src,/m.sourceEventId&&m.sourceTimestamp&&m.sourceProviderId/);
 assert.match(src,/<=300000/);
 assert.match(src,/\.slice\(0,100\)/);
});
test('does not pretend a bookmaker is an independent upstream',()=>{
 assert.match(src,/upstreamId:m.sourceProviderId/);
 assert.doesNotMatch(src,/upstreamId:m.sourceBook/);
});
