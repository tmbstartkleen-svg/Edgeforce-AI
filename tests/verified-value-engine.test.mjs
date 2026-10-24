import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync(new URL('../src/lib/verified-value-engine.ts',import.meta.url),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {americanBreakEven,evaluateIndependentBetEdge}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const now=Date.parse('2026-10-23T19:30:00Z');
const input={
 quote:{bookmaker:'DraftKings',sourceUpstreamId:'api.the-odds-api.com',eventId:'upcoming',
  marketType:'h2h',outcomeId:'Home',americanOdds:-117,
  observedAt:new Date(now-20000).toISOString(),startsAt:new Date(now+3600000).toISOString()},
 forecast:{probability:0.60,modelId:'example-independent',modelVersion:'test-v1',calibrated:true,
  independentlyDerived:true,asOf:new Date(now-60000).toISOString(),sampleSize:2000,calibrationMeanAbsoluteError:0.035},
 verification:{independentUpstreams:2,priceAgreement:true,sourceEntitlementVerified:true}
};
const evalWith=patch=>evaluateIndependentBetEdge({...input,...patch},now);
test('standard break-even math for negative and positive moneylines',()=>{
 assert.ok(Math.abs(americanBreakEven(-117)-117/217)<1e-12);
 assert.equal(americanBreakEven(150),0.4);
 for(const odds of [0,50,-99,101.2,Infinity])assert.throws(()=>americanBreakEven(odds),/INVALID_AMERICAN_ODDS/);
});
test('complete independently verified example computes edge ROI and bankroll cap',()=>{
 const r=evalWith({});
 assert.equal(r.status,'VERIFIED_CANDIDATE');
 assert.ok(Math.abs(r.edgePercentagePoints-(60-117/217*100))<1e-9);
 assert.ok(Math.abs(r.expectedRoiPercent-(0.6*100/117-0.4)*100)<1e-9);
 assert.ok(r.suggestedBankrollFraction>0&&r.suggestedBankrollFraction<=0.01);
});
test('positive win chance without real price verification is never promoted',()=>{
 for(const patch of [{verification:{...input.verification,independentUpstreams:1}},
  {verification:{...input.verification,sourceEntitlementVerified:false}},
  {verification:{...input.verification,priceAgreement:false}},
  {quote:{...input.quote,observedAt:new Date(now-3600000).toISOString()}},
  {forecast:{...input.forecast,calibrated:false}},
  {forecast:{...input.forecast,independentlyDerived:false}},
  {forecast:{...input.forecast,sampleSize:3}},
  {forecast:{...input.forecast,calibrationMeanAbsoluteError:0.18}},
  {forecast:{...input.forecast,asOf:new Date(now-90000000).toISOString()}}
 ]){
  const r=evalWith(patch);assert.equal(r.status,'BLOCKED');assert.equal(r.eligible,false);
  assert.equal(r.expectedRoiPercent,null);assert.equal(r.suggestedBankrollFraction,0);
 }
});
test('losing opportunity has zero suggested exposure despite valid data',()=>{
 const r=evalWith({forecast:{...input.forecast,probability:0.50}});
 assert.equal(r.status,'NO_POSITIVE_EDGE');
 assert.equal(r.eligible,false);assert.equal(r.suggestedBankrollFraction,0);
});
test('player prop without verifiable player ID or named line is blocked',()=>{
 let r=evalWith({quote:{...input.quote,marketType:'player_points',line:'20.5'}});
 assert.ok(r.reasons.includes('UNVERIFIED_PLAYER_ID'));
 r=evalWith({quote:{...input.quote,marketType:'player_points',playerId:'verified:12'}});
 assert.ok(r.reasons.includes('MISSING_MARKET_LINE'));
});
test('engine never makes a provider request, writes D1, or constructs a probability',()=>{
 assert.doesNotMatch(source,/fetch\(|INSERT INTO|writeFile|Math\.random/);
});
