import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=name=>ts.transpileModule(fs.readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const inventory=uri(compile('coverage-inventory'));
const source=compile('sports-coverage-report').replaceAll("from './coverage-inventory'","from "+JSON.stringify(inventory));
const {buildSportsCoverageReport}=await import(uri(source));
const asOf='2026-10-21T12:00:00Z';
const target={bookmaker:'DraftKings',sport:'Soccer',league:'EPL',eventId:'e1',marketType:'moneyline',outcomeId:'home'};
const obs={...target,provider:'feed-a',observedAt:asOf,startsAt:'2026-10-22T12:00:00Z',priceAmerican:-115};
const batch={provider:'feed-a',sourceTimestamp:asOf,observations:[obs],expected:[target],quota:{limit:100,remaining:30}};
const run=batches=>buildSportsCoverageReport({batches,asOf,bookmaker:'DraftKings',maxAgeMs:60000});
test('counts real source-backed sports leagues events and outcomes',()=>{
 const x=run([batch]);
 assert.equal(x.totals.sports,1);assert.equal(x.totals.leagues,1);assert.equal(x.totals.events,1);
 assert.equal(x.leagues[0].matched,1);assert.equal(x.providers[0].quota.remaining,30);assert.equal(x.coverageComplete,true);
});
test('reports absent tennis player props without manufacturing results',()=>{
 const prop={...target,sport:'Tennis',league:'ATP',eventId:'match2',marketType:'aces',playerId:'p1',outcomeId:'over',line:'6.5'};
 const x=run([{...batch,expected:[target,prop]}]);
 assert.equal(x.totals.missing,1);assert.equal(x.missingMarkets[0].target.playerId,'p1');
 assert.equal(x.leagues.find(x=>x.league==='ATP').missing,1);assert.equal(x.coverageComplete,false);
});
test('stale provider batch is excluded and marked unavailable',()=>{
 const x=run([{...batch,sourceTimestamp:'2026-10-20T12:00:00Z'}]);
 assert.equal(x.providers[0].state,'STALE');assert.equal(x.totals.outcomes,0);assert.equal(x.coverageComplete,false);
});
test('rejects invalid quota telemetry',()=>assert.throws(()=>run([{...batch,quota:{limit:10,remaining:11}}]),/INVALID_QUOTA/));
