import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const engine=read('src/lib/teamResearch.ts');
const api=read('src/app/api/team/research/route.ts');
const ui=read('src/components/TeamCommandCenter.tsx');
const page=read('src/app/team/page.tsx');
const home=read('src/app/page.tsx');

test('all six specialist roles are present, with a coordinator and source auditor',()=>{
 for(const name of ['scout','lines','props','arb','audit','captain'])assert.match(engine,new RegExp("id:'"+name+"'"));
 assert.match(engine,/TEAM_AGENTS/);
 assert.match(engine,/messages\.push\(message\('captain'/);
});

test('research distinguishes market-derived estimates from validated model probabilities',()=>{
 for(const token of ['independentModelVerified:false','quoteFreshnessVerified:false','actionableBetRecommendations:false']){
  assert.ok(engine.includes(token),token);
 }
 assert.match(engine,/NOT independently calibrated win probabilities/);
 assert.match(engine,/Stored\/demo quotes are never treated as executable arbitrage/);
});

test('team API reuses quota-aware provider ingestion without importing demo markets',()=>{
 assert.match(api,/ingestOdds\(\)/);
 assert.match(api,/scanEdgeOpportunities\(panelMarkets/);
 assert.doesNotMatch(api,/import.*demoMarkets/);
 assert.match(api,/auditMarketBatch\(markets\)/);
 assert.match(api,/REQUEST_TOO_LARGE/);
 assert.match(api,/QUESTION_REQUIRED_OR_TOO_LONG/);
 assert.match(api,/independentLLMEnabled:false/);
});

test('team chat accepts questions, displays collaboration, and saves limited local history',()=>{
 assert.match(ui,/fetch\('\/api\/team\/research'/);
 assert.match(ui,/teamRoundMeta/);
 assert.match(ui,/teamMessage/);
 assert.match(ui,/teamWelcome/);
 assert.match(ui,/localStorage\.setItem/);
 assert.match(ui,/slice\(-12\)/);
 assert.match(ui,/teamSuggestions/);
 assert.match(page,/TeamCommandCenter/);
 assert.match(home,/href="\/team"/);
});
