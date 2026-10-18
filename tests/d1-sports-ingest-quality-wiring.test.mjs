import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const src=fs.readFileSync(new URL('../worker/d1-sports-ingest.ts',import.meta.url),'utf8');
const gate=fs.readFileSync(new URL('../worker/d1-ingest-quality-gate.ts',import.meta.url),'utf8');
test('D1 sports ingest invokes gate before any sportsbook odds write',()=>{
 const check=src.indexOf('assessIngestEvidence('),write=src.indexOf('appendSportsMarketSnapshot(');
 assert.ok(check>=0&&write>check);assert.match(src,/INGEST_QUALITY_REJECTED/);
 assert.match(src,/observedAt:q\.observedAt/);
 assert.match(src,/sourceEventId/);
});
test('odds must be fresh and quality gate never authorizes bets',()=>{
 assert.match(gate,/kind==='odds'\?120000/);
 assert.match(gate,/approvedForBetting:false/);
});
