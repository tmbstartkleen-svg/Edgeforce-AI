import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const text=readFileSync(new URL('../src/lib/odds-stage1-acceptance.ts',import.meta.url),'utf8');
const source=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {evaluateOddsStage1Acceptance}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const now=Date.parse('2026-10-23T19:30:00Z');
const passed={
 providerRequest:{httpStatus:200,targetQuotes:19,observedAt:new Date(now-15000).toISOString(),upstreamId:'api.the-odds-api.com'},
 permittedStorage:{confirmed:true,provider:'the-odds-api',authorizedBy:'provider-authority',scope:'sportsbook odds pilot D1',expiresAt:new Date(now+86400000).toISOString()},
 pilotReadback:{exactReadbackComplete:true,expectedQuotes:19,readbackMatches:19,querySaturated:false,sourceId:'the-odds-api',upstreamId:'api.the-odds-api.com'},
 independentVerification:{independentUpstreams:2,priceAlignedOutcomes:12,verifiedOutcomes:12},
 marketCatalog:{complete:true,expectedMarkets:8,coveredMarkets:8}
};
test('complete external evidence can pass the stage gate but never claim release certification',()=>{
 const r=evaluateOddsStage1Acceptance(passed,now);
 assert.equal(r.acceptanceReady,true);
 assert.equal(r.releaseCertified,false);
 assert.deepEqual(r.blockers,[]);
});
test('missing evidence fails all five mandatory gates',()=>{
 const r=evaluateOddsStage1Acceptance({},now);
 assert.equal(r.acceptanceReady,false);
 assert.equal(r.blockers.length,5);
});
test('2026 observed quotes expire rapidly and cannot be reused for certification',()=>{
 assert.equal(evaluateOddsStage1Acceptance({...passed,providerRequest:{...passed.providerRequest,observedAt:new Date(now-900001).toISOString()}},now).checks.live,false);
 assert.equal(evaluateOddsStage1Acceptance({...passed,providerRequest:{...passed.providerRequest,observedAt:new Date(now+30000).toISOString()}},now).checks.live,false);
});
test('configured source is not contractual storage permission',()=>{
 const r=evaluateOddsStage1Acceptance({...passed,permittedStorage:{...passed.permittedStorage,confirmed:false}},now);
 assert.deepEqual(r.blockers,['PROVIDER_STORAGE_ENTITLEMENT_NOT_VERIFIED']);
});
test('readback must match the authenticated upstream and not be capped or partial',()=>{
 for(const changes of [{upstreamId:'other-source'},{querySaturated:true},{readbackMatches:18}]){
  const r=evaluateOddsStage1Acceptance({...passed,pilotReadback:{...passed.pilotReadback,...changes}},now);
  assert.equal(r.checks.readback,false);
 }
});
test('independent quotes must be price-aligned, and catalog must represent expected count',()=>{
 const r=evaluateOddsStage1Acceptance({...passed,
  independentVerification:{independentUpstreams:1,priceAlignedOutcomes:0,verifiedOutcomes:0},
  marketCatalog:{complete:true,expectedMarkets:30,coveredMarkets:8}},now);
 assert.deepEqual(r.blockers,['INDEPENDENT_ODDS_PRICE_AGREEMENT_NOT_VERIFIED','AUTHORIZED_MARKET_CATALOG_NOT_COMPLETE']);
});
test('gate is pure and does not fetch provider or mutate data',()=>{
 assert.doesNotMatch(text,/fetch\(|INSERT INTO|UPDATE intelligence_|DELETE FROM|appendD1Observations/);
});
