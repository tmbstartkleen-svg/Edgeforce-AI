import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const route=read('src/app/api/sportsbook-odds/route.ts');
const panel=read('src/components/SportsbookOddsPanel.tsx');
const providerRoute=read('src/app/api/sportsbook-odds/providers/route.ts');
const marketRoute=read('src/app/api/markets/route.ts');
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
 assert.match(panel,/fetch\('\/api\/markets\?forceLive=1'/);
 assert.match(marketRoute,/ingestOdds\(\{forceLive,persist:!forceLive\}\)/);
 assert.match(marketRoute,/searchParams\.get\('forceLive'\)==='1'/);
 assert.match(marketRoute,/checkNetworkAuth\(request\.headers\.get\('authorization'\),hash\)/);
 assert.match(marketRoute,/OWNER_AUTH_REQUIRED_FOR_METERED_REFRESH/);
 assert.match(panel,/Owner network token for sportsbook refresh/);
 assert.match(panel,/type="password"/);
 assert.match(panel,/Authorization:'Bearer '\+ownerToken\.trim\(\)/);
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

test('no-cost provider configuration diagnostics explain missing sportsbook prices',()=>{
 assert.match(providerRoute,/configuredProviders\('ODDS'\)/);
 assert.match(providerRoute,/credentialConfigured:Boolean\(p.apiKey\)/);
 assert.match(providerRoute,/credentialValuesExposed:false/);
 assert.match(providerRoute,/paidProviderRequests:0/);
 assert.doesNotMatch(providerRoute,/fetch\(|ingestOdds\(|THE_ODDS_API_KEY|apiKey:p\.apiKey|process\.env/);
 assert.match(panel,/api\/sportsbook-odds\/providers/);
 assert.match(panel,/Configured odds adapters/);
 assert.match(panel,/Provider attempted/);
 assert.match(panel,/No accepted prices/);
});

test('operator refresh returns bookmaker-specific upstream quote panel, never relabels consensus market',()=>{
 assert.match(marketRoute,/result\.panelMarkets/);
 assert.match(marketRoute,/sportsbookQuotes:quotes/);
 assert.match(marketRoute,/quoteScope:'PROVIDER_LABELED_RAW_QUOTES_NOT_CONSENSUS'/);
 assert.match(marketRoute,/sourceBook:m\.sourceBook/);
 assert.match(marketRoute,/sourceProviderId:m\.sourceProviderId/);
 assert.match(marketRoute,/result\.source==='demo'\?\[\]:/);
 assert.match(marketRoute,/draftKingsQuoteCount:quotes\.filter/);
 assert.match(panel,/body\.sportsbookQuotes\|\|\[\]/);
 assert.doesNotMatch(panel,/const quotes=\(body\.markets\|\|\[\]\)/);
 assert.match(panel,/reference price cannot be shown as a DraftKings quote/);
});

test('explicit provider refresh does not write odds snapshots or mirror research data',()=>{
 const ingestion=read('src/lib/providers/ingest.ts');
 assert.match(ingestion,/persist\?:boolean/);
 assert.match(ingestion,/if\(options\.persist!==false\)await Promise\.all/);
 assert.match(ingestion,/if\(options\.persist!==false&&process\.env\.INTELLIGENCE_WAREHOUSE_MIRROR_ENABLED/);
 assert.match(marketRoute,/persist:!forceLive/);
});

test('operator sees provider accepted market counts, quality, latency and prop coverage',()=>{
 assert.match(marketRoute,/providerPanel:result\.providerPanel/);
 assert.match(marketRoute,/quality:result\.quality/);
 assert.match(marketRoute,/rawCount:result\.rawCount/);
 assert.match(panel,/live\?\.providerPanel\?\.length/);
 assert.match(panel,/Accepted markets/);
 assert.match(panel,/playerPropRows/);
 assert.match(panel,/Latency/);
 assert.match(panel,/qualityGrade/);
});

test('owner-triggered refresh bypasses the panel and The Odds API in-memory caches',()=>{
 const ingest=read('src/lib/providers/ingest.ts');
 const odds=read('src/lib/providers/odds.ts');
 const http=read('src/lib/providers/http.ts');
 const theOdds=read('src/lib/providers/theOddsApi.ts');
 assert.match(ingest,/fetchNormalizedOdds\(\{forceRefresh:options\.forceLive===true\}\)/);
 assert.match(odds,/if\(!options\.forceRefresh&&oddsPanelCache/);
 assert.match(odds,/fetchProviderJson\(config,\{forceRefresh\}\)/);
 assert.match(http,/fetchTheOddsApiBoard\(config,options\)/);
 assert.match(theOdds,/if\(!options\.forceRefresh&&cache&&Date\.now\(\)-cache\.at<cache\.ttlMs\)/);
});
