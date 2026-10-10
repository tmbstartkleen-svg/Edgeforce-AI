import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/institutionalDesk.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
 reportDiagnostics:true
});
assert.equal(compiled.diagnostics.length,0);
const {buildInstitutionalDesk}=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));

const NOW=new Date('2026-10-10T16:00:00Z');
const liveQuote=(overrides={})=>({
 id:'market-1',sport:'NFL',league:'NFL',event:'Home v Away',selection:'Home ML',
 market:'h2h',startTime:'2026-10-10T19:00:00Z',odds:+120,marketProb:.4545,
 simProbability:.63,simCi:[.58,.68],simulationRuns:100000,dynamicConfidence:.82,
 grade:'ELITE',freshness:'FRESH',sourceAgeMin:1,sourceTimestamp:'2026-10-10T15:59:00Z',
 sourceBook:'Book A',regime:'STABLE',reliabilityMode:'NORMAL',intelligenceStackReady:true,
 contextQuality:{recommendationReady:true,score:.90},
 bestExecutionVenue:{venue:'Book A',type:'SPORTSBOOK',marketProbability:.4545,
  americanOdds:+120,expectedValue:.386,feeAdjusted:true},
 ...overrides
});
const make=(rows,overrides={})=>buildInstitutionalDesk({
 rows,source:'live',generatedAt:'2026-10-10T15:59:50Z',now:NOW,...overrides
});

test('V195 valid calibrated and fresh positive EV creates only a conditional entry window',()=>{
 const result=make([liveQuote()]);
 assert.equal(result.boardHealthy,true);
 assert.equal(result.ready,1);
 assert.equal(result.today[0].status,'ENTRY_WINDOW');
 assert.notEqual(result.today[0].entryMinAmericanOdds,0);
 assert.ok(result.today[0].entryPriceProbability<result.today[0].fairProbability);
 assert.match(result.today[0].reasons.join(' '),/Recheck live odds/);
});
test('V195 degraded or stale main board never exposes entry windows',()=>{
 for(const override of [{source:'stored'},{providerDegraded:true},{generatedAt:'2026-10-10T15:58:00Z'}]){
  const r=make([liveQuote()],override);
  assert.equal(r.ready,0);
  assert.equal(r.boardHealthy,false);
 }
});
test('V195 unknown or stale quote cannot be promoted to an entry',()=>{
 for(const override of [
  {sourceAgeMin:15,freshness:'AGING'},
  {sourceTimestamp:'2026-10-10T15:40:00Z'},
  {sourceTimestamp:undefined},
  {sourceBook:'Unknown venue',bestExecutionVenue:undefined},
  {grade:'PASS'},
  {simCi:[.40,.68]},
  {dynamicConfidence:.3},
  {contextQuality:{recommendationReady:false}},
  {reliabilityMode:'PROTECTIVE'},
  {intelligenceStackReady:false},
  {regime:'DISLOCATED'}
 ]){
  const r=make([liveQuote(override)]);
  assert.equal(r.ready,0,'should block '+JSON.stringify(override));
 }
});
test('V195 exchange quotes require fee-adjustment and contract match evidence',()=>{
 const exchange={venue:'Kalshi',type:'PREDICTION_EXCHANGE',marketProbability:.45,expectedValue:.18,feeAdjusted:false};
 let result=make([liveQuote({bestExecutionVenue:exchange,bestPredictionVenue:{status:'MATCHED'}})]);
 assert.equal(result.ready,0);
 result=make([liveQuote({bestExecutionVenue:{...exchange,feeAdjusted:true},bestPredictionVenue:{status:'NO_MATCH'}})]);
 assert.equal(result.ready,0);
 result=make([liveQuote({bestExecutionVenue:{...exchange,feeAdjusted:true},bestPredictionVenue:{status:'MATCHED'}})]);
 assert.equal(result.ready,1);
});
test('V195 near-future opportunity is monitored until the appropriate window',()=>{
 const tomorrow=liveQuote({id:'tomorrow',startTime:'2026-10-11T20:00:00Z'});
 const later=liveQuote({id:'later',startTime:'2026-10-14T20:00:00Z'});
 const result=make([tomorrow,later]);
 assert.equal(result.ready,0);
 assert.equal(result.tomorrow[0].status,'MONITOR');
 assert.equal(result.later[0].status,'MONITOR');
});
test('V195 reports its actual simulation count without inflating it',()=>{
 const result=make([liveQuote({simulationRuns:1500})]);
 assert.equal(result.today[0].simulationRuns,1500);
});
test('V195 never treats an already-started event as a future entry',()=>{
 const result=make([liveQuote({startTime:'2026-10-10T15:00:00Z'})]);
 assert.equal(result.ready,0);
 assert.equal(result.totalAnalyzed,0);
});
test('V195 desk is local; UI offers distinct days, readable statuses, and a real inspection action',()=>{
 const ui=readFileSync(new URL('../src/components/InstitutionalTradeDesk.tsx',import.meta.url),'utf8');
 const dashboard=readFileSync(new URL('../src/components/Dashboard.tsx',import.meta.url),'utf8');
 const styles=readFileSync(new URL('../src/app/globals.css',import.meta.url),'utf8');
 assert.doesNotMatch(source,/fetch\s*\(|axios|https?:\/\//);
 assert.match(ui,/Today.*Tomorrow.*Next 7 days|label\(window:DeskWindow\)/);
 assert.match(ui,/ENTRY WINDOW/);
 assert.match(ui,/No verified immediate entry/);
 assert.match(ui,/onInspect/);
 assert.match(dashboard,/href="#trade-desk"/);
 assert.match(ui,/id="trade-desk"/);
 assert.match(dashboard,/InstitutionalTradeDesk/);
 assert.match(styles,/institutionalDeskHead h2\{font-size:clamp/);
});

test('V195 negative estimated returns produce PASS rather than a positive trade signal',()=>{
 const result=make([liveQuote({
  odds:-200,marketProb:.667,simProbability:.63,simCi:[.59,.68],
  bestExecutionVenue:{venue:'Book A',type:'SPORTSBOOK',marketProbability:.667,
   americanOdds:-200,expectedValue:-.055,feeAdjusted:true}
 })]);
 assert.equal(result.ready,0);
 assert.equal(result.today[0].status,'PASS');
});
