import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const route=readFileSync(new URL('../src/app/api/live-board/route.ts',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/components/Dashboard.tsx',import.meta.url),'utf8');
const snapshot=readFileSync(new URL('../src/lib/boardSnapshotCache.ts',import.meta.url),'utf8');

test('V197 stale and degraded board data cannot be promoted as actionable picks',()=>{
 assert.match(route,/const providerQualified=ingestion\.source==='live'&&!ingestion\.degraded/);
 assert.match(route,/const qualifiedCandidates=providerQualified\?boardCandidates\.filter\(qualifiesForTopBoard\):\[\]/);
 assert.match(route,/grade:ingestion\.source==='live'\?'WATCH' as const:'PASS' as const/);
 assert.match(route,/expectedValue:0,quarterKelly:0,dynamicConfidence:0/);
 assert.match(route,/allowedGrades:providerQualified\?\['ELITE','STRONG'\]:\[\]/);
 assert.match(snapshot,/grade:'PASS',freshness:'STALE',expectedValue:0,quarterKelly:0/);
 assert.match(snapshot,/fallbackMode:'STALE_SNAPSHOT'/);
});
test('V197 503 recovery remains bounded and does not claim a live feed',()=>{
 assert.match(route,/Date\.now\(\)-oddsCache\.at>180000/);
 assert.match(route,/source:'stored' as const/);
 assert.match(route,/degraded:true/);
 assert.match(route,/const SOURCE_TTL_MS=15000/);
 assert.match(snapshot,/ttlMs=15000,staleMs=180000/);
 assert.match(route,/LIVE_BOARD_CORE_TIMEOUT/);
 assert.match(route,/status:503/);
});
test('V197 ingestion and context deadlines do not exhaust the entire core deadline',()=>{
 assert.match(route,/LIVE_BOARD_INGEST_TIMEOUT_MS\|\|11000/);
 assert.match(route,/LIVE_BOARD_CONTEXT_TIMEOUT_MS\|\|/);
 assert.match(route,/LIVE_BOARD_CORE_TIMEOUT_MS\|\|21000/);
 assert.match(route,/context state load/);
 assert.match(route,/context change persistence/);
});
test('V197 diagnostic UI identifies failing providers without treating a trusted feed as multi-book',()=>{
 assert.match(dashboard,/Accepted feed quality: .*not cross-book verification/);
 assert.match(dashboard,/Inspect provider diagnostics/);
 assert.match(dashboard,/p\.skipped\?'quarantined'/);
 assert.match(dashboard,/p\.error/);
});
