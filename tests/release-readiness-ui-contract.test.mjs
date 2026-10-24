import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const route=fs.readFileSync(new URL('../src/app/api/operations/edgeforce-release-readiness/route.ts',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../src/components/LeagueCoverageDashboard.tsx',import.meta.url),'utf8');
test('readiness endpoint is no-store and never trusts user-submitted certification evidence',async()=>{
 const js=ts.transpileModule(route,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const {GET}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const response=await GET();
 const result=await response.json();
 assert.equal(response.status,200);
 assert.match(response.headers.get('Cache-Control'),/no-store/);
 assert.equal(result.mode,'EVIDENCE_REQUIREMENTS_ONLY');
 assert.equal(result.stages.length,4);
 assert.equal(result.certifiedStages,0);
 assert.equal(result.remainingStages,4);
 assert.equal(result.verifiedBets,0);
 assert.equal(result.releaseCertified,false);
 assert.equal(result.noCurrentEvidenceFetch,true);
 assert.ok(result.stages.every(s=>s.status==='BLOCKED'&&s.requirements.length>=3));
 assert.doesNotMatch(route,/fetch\(|INSERT INTO|process\.env|Math\.random/);
});
test('league coverage UI includes the real fail-closed readiness view separate from score coverage',()=>{
 assert.match(ui,/api\/operations\/edgeforce-release-readiness/);
 assert.match(ui,/RELEASE EVIDENCE/);
 assert.match(ui,/release\.stages\.map/);
 assert.match(ui,/No certification is implied/);
 assert.match(ui,/CI passing alone does not certify live betting data/);
});

test('authenticated League Coverage drilldown checks real D1 odds registry without treating score sources as sportsbook odds',()=>{
 assert.match(ui,/api\/operations\/d1-pilot\/odds-launch-readiness/);
 assert.match(ui,/enabledSportsbookSources/);
 assert.match(ui,/storedOddsRows/);
 assert.match(ui,/distinctSportsbookUpstreams/);
 assert.match(ui,/This does not authorize ingestion or certify bets/);
 assert.match(ui,/setOddsLaunch\(null\)/);
});

test('separates historical odds inventory from eligible recent sportsbook observations',()=>{
 assert.match(ui,/freshRegisteredOddsRows/);
 assert.match(ui,/FRESH ELIGIBLE ODDS ROWS/);
 assert.match(ui,/Last 15 minutes; enabled sportsbook-odds sources only/);
 assert.match(ui,/freshnessBlocker/);
});
