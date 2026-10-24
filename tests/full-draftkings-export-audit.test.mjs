import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../src/lib/'+p,import.meta.url),'utf8');
const trans=p=>ts.transpileModule(read(p),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const code=trans('full-draftkings-export-audit.ts')
 .replace("from './draftkings-market-gap-audit'","from "+JSON.stringify(uri(trans('draftkings-market-gap-audit.ts'))));
const {auditFullDraftKingsOddsExport}=await import(uri(code));
const now=Date.parse('2026-10-23T20:00:00Z');
const event=(markets)=>[{id:'e1',sport_key:'basketball_nba',sport_title:'NBA',
 commence_time:new Date(now+3600000).toISOString(),bookmakers:[
 {key:'draftkings',title:'DraftKings',last_update:new Date(now-15000).toISOString(),markets}]}];
const h2h=(count)=>({key:'h2h',outcomes:Array.from({length:count},(_,i)=>({name:'selection'+i,price:-110}))});
const req={sport:'basketball_nba',league:'NBA',kind:'game',marketType:'h2h',eventId:'e1'};
test('exhaustive export inspects and counts all 40 prices, not capped at 25',()=>{
 const report=auditFullDraftKingsOddsExport(event([h2h(40)]),[req],now);
 assert.equal(report.pricedOutcomesExamined,40);
 assert.equal(report.validCoreQuotes,40);
 assert.equal(report.coveredCount,1);
 assert.equal(report.quoteCapReached,false);
 assert.equal(report.sourceEntitlementVerified,false);
 assert.equal(report.releaseCertified,false);
});
test('player props without stable athlete IDs are counted but never falsely covered',()=>{
 const report=auditFullDraftKingsOddsExport(event([
  {key:'player_points',outcomes:[{name:'Over',description:'Example Player',price:-110,point:22.5}]}
 ]),[{...req,kind:'player-prop',marketType:'player_points',playerId:'athlete-001',line:'22.5'}],now);
 assert.equal(report.provisionalPlayerPropOutcomes,1);
 assert.equal(report.validCoreQuotes,0);
 assert.equal(report.coveredCount,0);
 assert.equal(report.providerRejections.PROP_PLAYER_ID_NOT_STABLE,1);
});
test('priced unsupported markets are reported, rather than classified as covered',()=>{
 const r=auditFullDraftKingsOddsExport(event([{key:'mystery_market',outcomes:[{name:'Yes',price:-110}]}]),
 [{...req,marketType:'mystery_market'}],now);
 assert.equal(r.coveredCount,0);
 assert.equal(r.unmappedMarkets[0].marketType,'mystery_market');
});
test('invalid sample, stale books and empty catalog never certify completeness',()=>{
 assert.throws(()=>auditFullDraftKingsOddsExport({},[],now),/INVALID_FULL_CATALOG_EXPORT/);
 const old=event([h2h(2)]);old[0].bookmakers[0].last_update=new Date(now-3600000).toISOString();
 const r=auditFullDraftKingsOddsExport(old,[],now);
 assert.equal(r.validCoreQuotes,0);
 assert.equal(r.coverageComplete,false);
});
test('module performs no provider queries, D1 writes or externally authenticated claims',()=>{
 assert.doesNotMatch(read('full-draftkings-export-audit.ts'),/fetch\(|INSERT INTO|writeFile\(/);
});
