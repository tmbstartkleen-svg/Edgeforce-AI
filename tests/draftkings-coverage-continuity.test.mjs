import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=p=>ts.transpileModule(fs.readFileSync(new URL('../src/lib/'+p,import.meta.url),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const code=compile('draftkings-coverage-continuity.ts')
 .replace("from './draftkings-market-gap-audit'","from "+JSON.stringify(uri(compile('draftkings-market-gap-audit.ts'))));
const {auditDraftKingsCoverageContinuity}=await import(uri(code));
const expected=[{sport:'soccer',league:'Premier League',marketType:'h2h',kind:'game',eventId:'fixture-1'},
 {sport:'basketball_nba',league:'NBA',marketType:'player_points',kind:'player-prop',
  eventId:'fixture-2',playerId:'athlete-1',line:'20.5'}];
const date='2026-10-23T19:00:00Z',now=Date.parse(date);
const quote=(extra={})=>({sport:'soccer',league:'Premier League',marketType:'h2h',
 eventId:'fixture-1',bookmaker:'DraftKings',sourceUpstreamId:'odds-one',outcomeId:'home',
 americanOdds:-110,observedAt:'2026-10-23T18:00:00Z',startsAt:'2026-10-23T23:00:00Z',...extra});
const snapshot=(asOf,quotes)=>({asOf,sourceId:'source-one',quotes:quotes.map(q=>({...q,observedAt:new Date(Date.parse(asOf)-1000).toISOString()}))});
test('persistent unavailable player props are separate from temporarily missing soccer prices',()=>{
 const snapshots=[
  snapshot('2026-10-23T18:00:00Z',[quote()]),
  snapshot('2026-10-23T18:20:00Z',[]),
  snapshot('2026-10-23T18:40:00Z',[quote()])
 ];
 const r=auditDraftKingsCoverageContinuity(expected,snapshots,now);
 assert.equal(r.persistentMissingCount,1);
 assert.equal(r.intermittentMissingCount,1);
 assert.equal(r.persistentMissing[0].kind,'player-prop');
 assert.equal(r.intermittentMissing[0].marketType,'h2h');
 assert.equal(r.latestCoveragePercent,50);
 assert.equal(r.releaseCertified,false);
});
test('a single batch or unknown expected catalog cannot establish persistent gaps',()=>{
 const r=auditDraftKingsCoverageContinuity(expected,[snapshot('2026-10-23T18:00:00Z',[])],now);
 assert.equal(r.persistentMissingCount,0);assert.equal(r.evidenceSufficientForTrend,false);
 assert.equal(auditDraftKingsCoverageContinuity([],[],now).latestCoveragePercent,null);
});
test('duplicate requirements and out-of-order timestamps prevent trustworthy trend evidence',()=>{
 const r=auditDraftKingsCoverageContinuity([...expected,expected[0]],[snapshot('2026-10-23T18:00:00Z',[])],now);
 assert.equal(r.duplicateExpectedCount,1);
 assert.equal(r.evidenceSufficientForTrend,false);
 assert.throws(()=>auditDraftKingsCoverageContinuity(expected,[
  snapshot('2026-10-23T18:20:00Z',[]),snapshot('2026-10-23T18:00:00Z',[])],now),/INVALID_CONTINUITY_TIME_SEQUENCE/);
});
test('coverage continuity must remain local and cannot issue sportsbook certification',()=>{
 assert.doesNotMatch(compile('draftkings-coverage-continuity.ts'),/fetch\\(|INSERT INTO|writeFile\\(/);
});
