import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const route=fs.readFileSync(new URL('../src/app/api/value-board/verified/route.ts',import.meta.url),'utf8');
const provisional=fs.readFileSync(new URL('../src/app/api/value-board/route.ts',import.meta.url),'utf8');
test('verified value API never treats provisional market-reference source as independent model',()=>{
 assert.match(route,/buildVerifiedValueBoard\(\[\],asOf,50\)/);
 assert.match(route,/evaluateOddsStage1Acceptance\(\{\},asOf\)/);
 assert.match(route,/mode:'VERIFIED_ONLY'/);
 assert.match(route,/certified:false/);
 assert.match(route,/eligibleForAutomatedBetAlerts:false/);
 assert.match(route,/Cache-Control':'no-store/);
 assert.doesNotMatch(route,/ingestOdds\(|rankValueBets\(|scanEdgeOpportunities\(/);
});
test('existing provisional research board remains explicit about non-independent probability',()=>{
 assert.match(provisional,/PROVISIONAL_MARKET_REFERENCE/);
 assert.match(provisional,/modelIndependent:false/);
 assert.match(provisional,/eligibleForAutomatedBetAlerts:false/);
});
