import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const raw=fs.readFileSync(new URL('../src/lib/closing-line-value-audit.ts',import.meta.url),'utf8');
const code=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {auditClosingLineValue}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const now=Date.parse('2026-10-23T20:00:00Z');
const example=(overrides={})=>({bookmaker:'DraftKings',sourceUpstreamId:'odds-api',
 closingUpstreamId:'odds-api',eventId:'e1',marketType:'h2h',outcomeId:'home',
 placedAmericanOdds:-110,closingAmericanOdds:-130,
 placedAt:'2026-10-22T18:00:00Z',closedAt:'2026-10-23T18:00:00Z',
 startsAt:'2026-10-23T18:30:00Z',...overrides});
test('closing line comparison converts both prices to decimal payout and reports CLV',()=>{
 const r=auditClosingLineValue([example()],now);
 const expected=((1+100/110)/(1+100/130)-1)*100;
 assert.ok(Math.abs(r.averageClvPercent-expected)<1e-10);
 assert.equal(r.beatCloseCount,1);
 assert.equal(r.actualProfitVerified,false);
 assert.equal(r.releaseCertified,false);
});
test('worse placement than close is negative CLV, not evidence of no possible win',()=>{
 const r=auditClosingLineValue([example({placedAmericanOdds:-140,closingAmericanOdds:-110})],now);
 assert.equal(r.beatCloseCount,0);
 assert.ok(r.averageClvPercent<0);
});
test('reject future game closes, lookahead, duplicate snapshots and incomplete market lines',()=>{
 const base=example();
 const r=auditClosingLineValue([base,base,
  example({eventId:'e2',closedAt:'2026-10-23T19:00:00Z'}),
  example({eventId:'e3',marketType:'player_points',line:'20.5',playerId:'name:player'}),
  example({eventId:'e4',marketType:'totals'})],now);
 assert.equal(r.comparablePairs,1);
 assert.equal(r.rejected.DUPLICATE_PAIR,1);
 assert.equal(r.rejected.INVALID_PRICE_TIMELINE,1);
 assert.equal(r.rejected.UNVERIFIED_PLAYER_ID,1);
 assert.equal(r.rejected.MISSING_LINE,1);
});
test('market identifier and line prevent incorrectly pooled duplicates',()=>{
 const q=example({marketType:'totals',line:'200.5'});
 const r=auditClosingLineValue([q,example({marketType:'totals',line:'201.5'})],now);
 assert.equal(r.comparablePairs,2);
});
test('bounded, offline module makes no claims of real ROI',()=>{
 assert.throws(()=>auditClosingLineValue([],Infinity),/INVALID_CLV_INPUT/);
 assert.doesNotMatch(raw,/fetch\(|INSERT INTO|Math\.random/);
});
