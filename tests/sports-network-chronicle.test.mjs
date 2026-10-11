import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const compiled=ts.transpileModule(source('../src/lib/sportsNetworkChronicle.ts'),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true
});
assert.equal(compiled.diagnostics?.length??0,0);
const {chroniclePast,chroniclePresent,chronicleFuture,assessForecast}=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));
const now=Date.parse('2026-10-10T21:00:00Z');
const base={eventId:'nfl:test',sport:'NFL',league:'NFL',home:'Buffalo Bills',away:'Miami Dolphins',startTime:'2026-10-11T21:00:00Z'};
const forecast=(patch={})=>({
 ...base,modelVersion:'version-x',market:'h2h',selection:'Buffalo Bills',probability:.58,runs:10000,
 ciLow:.55,ciHigh:.61,createdAt:'2026-10-10T20:00:00Z',
 calibrationSample:400,calibrationError:.04,brierScore:.20,
 calibrationPeriodEnd:'2026-10-01',...patch
});
test('V207 forecast probabilities never become facts or trade approvals',()=>{
 const result=chronicleFuture([forecast()],now);
 assert.equal(result.entries.length,1);
 assert.equal(result.entries[0].forecastEvidence,'RESEARCH_SUPPORTED');
 assert.equal(result.entries[0].approvedForTrading,false);
 assert.equal(result.entries[0].realWorldOutcomeKnown,false);
 assert.deepEqual(result.entries[0].monteCarloInterval,[.55,.61]);
 assert.match(result.warning,/model outputs/);
});
test('V207 low samples, missing outcome calibration and old models reject research-supported status',()=>{
 assert.equal(assessForecast(forecast({calibrationSample:20}),now).evidence,'UNCALIBRATED');
 assert.equal(assessForecast(forecast({calibrationSample:null}),now).evidence,'UNCALIBRATED');
 assert.equal(assessForecast(forecast({brierScore:.35}),now).evidence,'UNCALIBRATED');
 assert.equal(assessForecast(forecast({runs:50}),now).evidence,'UNCALIBRATED');
 assert.equal(assessForecast(forecast({createdAt:'2026-10-07T20:00:00Z'}),now).evidence,'STALE_MODEL');
 assert.equal(assessForecast(forecast({ciLow:.65}),now).evidence,'INVALID_MODEL');
 assert.equal(assessForecast(forecast({probability:1}),now).evidence,'INVALID_MODEL');
 assert.equal(assessForecast(forecast({startTime:'2026-10-09T00:00:00Z'}),now).evidence,'INVALID_MODEL');
});
test('V207 past archive does not confuse bet settlement with official game score',()=>{
 const r=chroniclePast([{...base,startTime:'2026-10-09T12:00:00Z',
  market:'h2h',selection:'Buffalo Bills',offeredOdds:-125,
  bookmaker:'DraftKings',provider:'espn-core-odds',observedAt:'2026-10-09T10:00:00Z',
  hasSettlementEvidence:true,gameResultConfirmed:false}],now);
 assert.equal(r.entries[0].settlementReferenceAvailable,true);
 assert.equal(r.entries[0].gameResultConfirmed,false);
 assert.equal(r.entries[0].outcome,'NOT_VERIFIED');
 assert.equal(r.coverage.verifiedFinalScores,0);
});
test('V207 present quote age is source-conservative and no external score is fabricated',()=>{
 const recent=chroniclePresent([{...base,market:'h2h',selection:'Buffalo Bills',
  odds:-110,bookmaker:'DraftKings',provider:'espn-core-odds',
  sourceObservedAt:'2026-10-10T20:59:30Z',pulledAt:'2026-10-10T20:59:55Z'}],now);
 assert.equal(recent.entries[0].status,'RECENT_OBSERVATION');
 assert.equal(recent.entries[0].ageSeconds,30);
 assert.equal(recent.entries[0].executable,false);
 assert.equal(recent.coverage.uniqueBookmakers,1);
 assert.equal(recent.coverage.uniqueUpstreams,1);
 const stale=chroniclePresent([{...base,market:'h2h',selection:'Buffalo Bills',
  odds:-110,bookmaker:'DraftKings',provider:'sharp-api',
  sourceObservedAt:'2026-10-10T20:30:00Z',pulledAt:'2026-10-10T20:59:55Z'}],now);
 assert.equal(stale.entries[0].status,'STALE_OBSERVATION');
 assert.equal(stale.coverage.recentQuotes,0);
 const missing=chroniclePresent([{...base,market:null,selection:null,
  odds:null,bookmaker:null,provider:null,sourceObservedAt:null,pulledAt:null}],now);
 assert.equal(missing.entries[0].status,'NO_VERIFIED_QUOTE');
 assert.equal(missing.coverage.uniqueUpstreams,0);
});
test('V207 API must require owner token, bound SQL result sizes, and separate eras',()=>{
 const api=source('../src/app/api/network/v1/intelligence/route.ts');
 const ui=source('../src/components/SportsNetworkChronicle.tsx');
 const dashboard=source('../src/components/Dashboard.tsx');
 assert.match(api,/authorizeNetwork\(request\)/);
 assert.match(api,/era==='past'/);
 assert.match(api,/era==='present'/);
 assert.match(api,/from model_runs mr/);
 assert.match(api,/from calibration_metrics/);
 assert.match(api,/limit 50/);
 assert.match(api,/limit 100/);
 assert.doesNotMatch(api,/\bfetch\(/);
 assert.doesNotMatch(api,/fetchTheOddsApiBoard|fetchSharpApiBoard/);
 assert.match(dashboard,/href="#sports-network"/);
 assert.match(dashboard,/SportsNetworkChronicle/);
 assert.match(ui,/type="password"/);
 assert.match(ui,/No automatic retry was sent/);
 assert.doesNotMatch(ui,/localStorage|setInterval/);
});
