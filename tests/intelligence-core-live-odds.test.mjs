import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/lib/intelligence-core/live-odds-adapter.ts',import.meta.url),'utf8');
test('mirroring is opt-in and rejects stored or demo sources',()=>{
 assert.match(src,/INTELLIGENCE_WAREHOUSE_MIRROR_ENABLED/);
 assert.match(src,/batch.source!=='live'/);
});
test('observations require event and provenance timestamps',()=>{
 assert.match(src,/!m.sourceEventId\|\|!m.sourceTimestamp\|\|!m.sourceProviderId/);
 assert.match(src,/>300000/);
 assert.match(src,/candidates.length>=100/);
});
test('does not pretend a bookmaker is an independent upstream',()=>{
 assert.match(src,/upstreamId:m.sourceProviderId/);
 assert.match(src,/provider:m.sourceProviderId/);
 assert.doesNotMatch(src,/provider:batch.providerId/);
 assert.doesNotMatch(src,/upstreamId:m.sourceBook/);
});

test('reports why genuine sportsbook observations are excluded',()=>{
 assert.match(src,/missingProvenance/);
 assert.match(src,/invalidTimestamp/);
 assert.match(src,/staleTimestamp/);
 assert.match(src,/invalidOdds/);
 assert.match(src,/diagnostic\.eligible=candidates\.length/);
});

test('aggregator-level batch id cannot replace the individual upstream source',()=>{
 assert.match(src,/provider:m.sourceProviderId!/);
 assert.doesNotMatch(src,/batch.source!=='live'\|\|!batch.providerId/);
});
