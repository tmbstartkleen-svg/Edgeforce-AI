import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../src/lib/intelligence-core/injury-adapter.ts',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/lib/liveInjuryTracking.ts',import.meta.url),'utf8');
test('injury collector only stores source-dated observations',()=>{
 assert.match(code,/reportedAt/);
 assert.match(code,/NO_SOURCE_DATED_REPORTS/);
 assert.match(code,/timestamp>now/);
});
test('existing snapshots remain independent of opt-in mirror',()=>{
 assert.match(source,/mirrorInjuryReports/);
 assert.match(source,/INTELLIGENCE_WAREHOUSE_INJURY_MIRROR/);
 assert.match(source,/insert into injury_context_snapshots/);
});
