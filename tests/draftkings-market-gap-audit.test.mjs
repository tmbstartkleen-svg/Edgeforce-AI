import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const raw=fs.readFileSync(new URL('../src/lib/draftkings-market-gap-audit.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {auditDraftKingsMarketCoverage}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const now=Date.parse('2026-10-23T20:00:00Z');
const quote=(extra={})=>({sport:'basketball_nba',league:'NBA',marketType:'h2h',eventId:'e1',
 bookmaker:'DraftKings',sourceUpstreamId:'api.the-odds-api.com',outcomeId:'home',
 observedAt:new Date(now-30000).toISOString(),startsAt:new Date(now+7200000).toISOString(),
 americanOdds:-115,...extra});
const required=(extra={})=>({sport:'basketball_nba',league:'NBA',marketType:'h2h',kind:'game',...extra});
test('sports gap audit measures only actual priced DK outcomes against explicit required catalog',()=>{
 const r=auditDraftKingsMarketCoverage([required(),required({league:'WNBA'}),required({sport:'soccer_england_premier_league',league:'Premier League'})],[quote()],now);
 assert.equal(r.requiredCount,3);assert.equal(r.coveredCount,1);assert.equal(r.missingCount,2);
 assert.ok(Math.abs(r.coveragePercent-100/3)<1e-9);
 assert.equal(r.coverageComplete,false);
});
test('event-scoped player props require priced outcome, line, known player and exact event',()=>{
 const prop=required({marketType:'player_points',kind:'player-prop',eventId:'e1'});
 const good=quote({marketType:'player_points',playerId:'athlete:00001',line:'24.5'});
 const other=quote({marketType:'player_points',playerId:'athlete:00001',line:'24.5',eventId:'e2'});
 const name=quote({marketType:'player_points',playerId:'name:john smith',line:'24.5'});
 assert.equal(auditDraftKingsMarketCoverage([prop],[good],now).coveredCount,1);
 assert.equal(auditDraftKingsMarketCoverage([prop],[other],now).coveredCount,0);
 const a=auditDraftKingsMarketCoverage([prop],[name],now);
 assert.equal(a.coveredCount,0);assert.equal(a.rejected.PROVISIONAL_PLAYER_PROP,1);
});
test('scoreboards, other bookmakers, stale and unpriced outcomes cannot claim coverage',()=>{
 const observations=[
  quote({bookmaker:'FanDuel'}),quote({americanOdds:0}),
  quote({observedAt:new Date(now-3600000).toISOString()}),
  quote({startsAt:new Date(now-3600000).toISOString()})];
 const r=auditDraftKingsMarketCoverage([required()],observations,now);
 assert.equal(r.coveredCount,0);
 assert.equal(r.rejected.NOT_VALID_DRAFTKINGS_ODDS,2);
 assert.equal(r.rejected.STALE_OR_STARTED,2);
});
test('duplicate expected markets cannot artificially enlarge denominator',()=>{
 const a=auditDraftKingsMarketCoverage([required(),required()],[quote()],now);
 assert.equal(a.requiredCount,1);assert.equal(a.coveredCount,1);
 assert.equal(a.rejected.DUPLICATE_REQUIRED_MARKET,1);
});
test('no expected catalog is unknown, never complete or 100 percent coverage',()=>{
 const r=auditDraftKingsMarketCoverage([],[quote()],now);
 assert.equal(r.coverageComplete,false);assert.equal(r.coveragePercent,null);
 assert.equal(r.releaseCertified,false);
});
test('misclassified market, incomplete props and invalid catalogs fail closed',()=>{
 const a=auditDraftKingsMarketCoverage([required({marketType:'player_points'})],[quote({marketType:'player_points',line:'12.5',playerId:'athlete-1'})],now);
 assert.equal(a.coveredCount,0);
 const b=auditDraftKingsMarketCoverage([required({marketType:'player_points',kind:'player-prop'})],[quote({marketType:'player_points',playerId:'athlete-1'})],now);
 assert.equal(b.rejected.MISSING_LINE,1);
 assert.throws(()=>auditDraftKingsMarketCoverage([],[],Infinity),/INVALID_COVERAGE_INPUT/);
 assert.doesNotMatch(raw,/fetch\(|INSERT INTO|Math\.random/);
});

test('two players or alternate lines in same event are independent catalog requirements',()=>{
 const base=required({marketType:'player_points',kind:'player-prop',eventId:'e1'});
 const observed=[quote({marketType:'player_points',playerId:'athlete-1',line:'20.5'})];
 const a=auditDraftKingsMarketCoverage([
  {...base,playerId:'athlete-1',line:'20.5'},
  {...base,playerId:'athlete-2',line:'20.5'},
  {...base,playerId:'athlete-1',line:'21.5'}
 ],observed,now);
 assert.equal(a.requiredCount,3);assert.equal(a.coveredCount,1);
 assert.equal(a.missingCount,2);
 assert.equal(a.missing[0].reason,'REQUIRED_PLAYER_OR_LINE_NOT_PRICED');
});
