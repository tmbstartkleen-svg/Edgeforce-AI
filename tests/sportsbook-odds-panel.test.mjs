import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const route=read('src/app/api/sportsbook-odds/route.ts');
const panel=read('src/components/SportsbookOddsPanel.tsx');
const dashboard=read('src/components/LeagueCoverageDashboard.tsx');
test('sportsbook odds displayed in league coverage with explicit bookmaker provenance',()=>{
 assert.match(dashboard,/import SportsbookOddsPanel/);
 assert.match(dashboard,/<SportsbookOddsPanel\s*\/>/);
 assert.match(panel,/DraftKings and reference sportsbook prices/);
 assert.match(panel,/q\.sourceBook/);
 assert.match(panel,/q\.sourceProviderId/);
 assert.match(panel,/q\.sourceAgeMin/);
 assert.match(panel,/DraftKings only/);
});
test('stored quote endpoint is read-only and blocks demo/expired/invalid prices',()=>{
 assert.match(route,/latestStoredMarkets\(500\)/);
 assert.match(route,/age<=15/);
 assert.match(route,/Date\.parse\(m.startTime\)>now/);
 assert.match(route,/demo\|simulation\|synthetic\|mock/);
 assert.match(route,/hasVerifiedLiveQuotes:false/);
 assert.match(route,/providerRequests:0,writesPerformed:0/);
 assert.doesNotMatch(route,/fetchNormalizedOdds\(|ingestOdds\(|fetch\(|INSERT INTO|UPDATE .* SET/i);
});
test('paid provider refresh is operator-only and does not auto-fire on page load',()=>{
 assert.match(panel,/const refreshProvider=async/);
 assert.match(panel,/onClick=\{refreshProvider\}/);
 assert.match(panel,/fetch\('\/api\/markets'/);
 const effect=panel.slice(panel.indexOf('useEffect('),panel.indexOf('const refreshProvider=async'));
 assert.doesNotMatch(effect,/api\/markets/);
 assert.match(effect,/api\/sportsbook-odds/);
 assert.match(panel,/body\.source==='demo'/);
 assert.match(panel,/Other bookmaker prices were found/);
});
test('new sportsbook UI JSX and endpoint TypeScript transpile cleanly',()=>{
 for(const [filename,source] of [['SportsbookOddsPanel.tsx',panel],['route.ts',route]]){
  const x=ts.transpileModule(source,{fileName:filename,reportDiagnostics:true,compilerOptions:{
   module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
  const errors=(x.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.deepEqual(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')),[]);
 }
});
