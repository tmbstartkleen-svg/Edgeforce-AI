import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/independent-quote-consensus.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {independentQuoteConsensus}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const now='2026-10-21T12:00:00Z';
const a={upstreamId:'owner-a',providerId:'feed-a',bookmaker:'DraftKings',sport:'NBA',league:'NBA',eventId:'game1',marketType:'player_points',playerId:'p1',line:'22.5',outcomeId:'over',priceAmerican:-110,observedAt:'2026-10-21T11:59:55Z',startsAt:'2026-10-21T15:00:00Z'};
const b={...a,upstreamId:'owner-b',providerId:'feed-b',priceAmerican:-115};
const run=quotes=>independentQuoteConsensus(quotes,now);
test('distinct upstream owners corroborate identical event and prop line',()=>assert.equal(run([a,b]).verifiedOutcomes,1));
test('different vendors using one upstream do not corroborate',()=>assert.equal(run([a,{...b,upstreamId:'owner-a'}]).verifiedOutcomes,0));
test('different line, player, bookmaker or event never corroborates',()=>{
 for(const value of [{line:'23.5'},{playerId:'p2'},{bookmaker:'FanDuel'},{eventId:'game2'},{outcomeId:'under'}])
  assert.equal(run([a,{...b,...value}]).verifiedOutcomes,0);
});
test('out-of-window quotes never corroborate',()=>assert.equal(run([a,{...b,observedAt:'2026-10-21T11:59:05Z'}]).verifiedOutcomes,0));
test('invalid and stale prices or started events fail closed',()=>{
 for(const value of [{priceAmerican:0},{observedAt:'2026-10-21T11:55:00Z'},{startsAt:'2026-10-21T11:59:59Z'}])
  assert.equal(run([a,{...b,...value}]).verifiedOutcomes,0);
});

test('sport, league, and scheduled start must agree',()=>{
 for(const change of [{sport:'NHL'},{league:'WNBA'},{startsAt:'2026-10-21T16:00:00Z'}])
  assert.equal(run([a,{...b,...change}]).verifiedOutcomes,0);
});

test('independent sources can agree on market identity yet disagree materially on price',()=>{
 const r=run([a,{...b,priceAmerican:+150}]);
 assert.equal(r.verifiedOutcomes,1);
 assert.equal(r.priceAlignedOutcomes,0);
 assert.equal(r.verified[0].priceAligned,false);
 assert.ok(r.verified[0].impliedProbabilitySpread>.02);
});
test('modest implied-probability differences count only as aligned research prices',()=>{
 const r=run([a,b]);
 assert.equal(r.priceAlignedOutcomes,1);
 assert.equal(r.verified[0].priceAligned,true);
});
