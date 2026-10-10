import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/parlayResearch.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics?.length??0,0);
const {assessResearchLeg,analyzeParlayConflicts,rankResearchPool}=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));
const NOW=Date.parse('2026-10-10T16:00:00Z');
const row=(overrides={})=>({
 id:'nfl-1',sport:'NFL',event:'Away at Home',market:'h2h',selection:'Home',
 startTime:'2026-10-10T19:00:00Z',odds:+125,simProbability:.59,expectedValue:.08,
 grade:'ELITE',freshness:'FRESH',sourceAgeMin:1,dynamicConfidence:.82,
 reliabilityMode:'NORMAL',reliabilityCriticalOpen:false,intelligenceStackReady:true,
 contextQuality:{recommendationReady:true},
 consensus:{bookCount:3},...overrides
});
test('V198 strict leg eligibility requires freshness, independent bookmaker coverage and intact model confidence',()=>{
 assert.equal(assessResearchLeg(row(),NOW).eligible,true);
 for(const blocked of [
  {grade:'PASS'}, {freshness:'STALE'}, {sourceAgeMin:8}, {dynamicConfidence:.4},
  {reliabilityMode:'PROTECTIVE'}, {contextQuality:{recommendationReady:false}},
  {consensus:{bookCount:1}}, {startTime:'2026-10-10T15:00:00Z'},
  {odds:20}, {simProbability:Number.NaN}
 ]) assert.equal(assessResearchLeg(row(blocked),NOW).eligible,false,JSON.stringify(blocked));
});
test('V198 same-event opposite game outcomes cannot silently combine in a parlay',()=>{
 const h=row({id:'home',selection:'Home'});
 const a=row({id:'away',selection:'Away'});
 assert.match(analyzeParlayConflicts([h,a]).join(' '),/Conflicting/);
 assert.deepEqual(analyzeParlayConflicts([h,{...a,event:'Different game'}]),[]);
 assert.match(analyzeParlayConflicts([h,h]).join(' '),/Duplicate/);
});
test('V198 same-player overlapping props require settlement validation',()=>{
 const first=row({id:'a',market:'player_points',selection:'Athlete over 20.5',playerContext:{name:'Athlete',statKey:'points'}});
 const second=row({id:'b',market:'player_points',selection:'Athlete under 20.5',playerContext:{name:'Athlete',statKey:'points'}});
 assert.match(analyzeParlayConflicts([first,second]).join(' '),/Same-player/);
});
test('V198 ranking exposes filtered model candidates without converting watchlist to recommendations',()=>{
 const [good,bad]=rankResearchPool([row({id:'bad',grade:'PASS',simProbability:.99}),row({id:'good',simProbability:.60})],'BALANCED',NOW);
 assert.equal(good.row.id,'good');assert.equal(good.gate.eligible,true);
 assert.equal(bad.row.id,'bad');assert.equal(bad.gate.eligible,false);
});
test('V198 premium sports command center is independently navigable and Parlay Lab uses joint simulator',()=>{
 const dashboard=readFileSync(new URL('../src/components/Dashboard.tsx',import.meta.url),'utf8');
 const studio=readFileSync(new URL('../src/components/ParlayStudio.tsx',import.meta.url),'utf8');
 const center=readFileSync(new URL('../src/components/SportsCommandCenter.tsx',import.meta.url),'utf8');
 const parlays=readFileSync(new URL('../src/lib/parlays.ts',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/app/globals.css',import.meta.url),'utf8');
 assert.match(dashboard,/setWorkspace\('command'\)/);
 assert.match(dashboard,/Edge Scanner/);
 assert.match(dashboard,/Parlay Lab/);
 assert.match(dashboard,/SportsCommandCenter rows=/);
 assert.match(dashboard,/ParlayStudio rows=/);
 assert.match(dashboard,/efLegacyParlay/);
 assert.match(studio,/analyzeCustomParlay/);
 assert.match(studio,/analyzeParlayConflicts/);
 assert.match(studio,/Same-game sportsbook repricing is not provided/);
 assert.match(studio,/price|odds/i);
 assert.match(parlays,/return summarize\(rows,'CUSTOM CORRELATION-AWARE RESEARCH SLIP'/);
 assert.match(center,/Highest-confidence trade review/);
 assert.match(css,/@media\(max-width:650px\)/);
});
