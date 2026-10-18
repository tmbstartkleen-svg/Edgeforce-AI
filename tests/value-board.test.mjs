import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const scanner=fs.readFileSync(new URL('../src/lib/valueBoard.ts',import.meta.url),'utf8');
const route=fs.readFileSync(new URL('../src/app/api/value-board/route.ts',import.meta.url),'utf8');
test('ranks across sports by ROI not win percentage',()=>{
 assert.match(scanner,/b\.expectedRoiPercent-a\.expectedRoiPercent/);
 assert.doesNotMatch(scanner,/b\.modelWinPercent-a\.modelWinPercent/);
});
test('market-derived probabilities never claim independent verified edge',()=>{
 assert.match(scanner,/MARKET_REFERENCE_ONLY/);
 assert.match(scanner,/eligibleForVerifiedAlert:false/);
 assert.match(route,/modelIndependent:false/);
 assert.match(route,/eligibleForAutomatedBetAlerts:false/);
});
test('returns raw quantities and evidence source',()=>{
 for(const key of ['modelWinPercent','breakEvenPercent','edgePp','expectedRoiPercent','referenceBooks'])assert.ok(scanner.includes(key));
 assert.match(route,/truncatedAtScanner/);
});
