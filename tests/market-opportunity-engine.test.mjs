import test from 'node:test';
import assert from 'node:assert/strict';
import {scanArbitrage,screenValueEdges,impliedProbability,decimalOdds,validatedQuote} from '../src/lib/intelligence-core/market-opportunity-engine.mjs';
const now=Date.now();
const base={eventId:'nba:2026:game-1',marketKey:'full-game-moneyline',settlementKey:'nba:full-game:regulation-plus-ot',currency:'USD',
 venueType:'SPORTSBOOK',side:'BACK',outcomeSetType:'TWO_WAY',outcomes:['Home','Away'],providerId:'providerA',upstreamId:'operatorA',observedAt:now};
const quote=(selection,bookmaker,odds,extra={})=>({...base,selection,bookmaker,odds,...extra});
test('american to decimal and implied probability conversions are correct',()=>{
 assert.ok(Math.abs(decimalOdds(-110)-1.909090909)<.0001);
 assert.equal(decimalOdds(150),2.5);assert.equal(impliedProbability(150),.4);
});
test('genuine two-book theoretical arbitrage produces dutching stakes',()=>{
 const q=[quote('Home','DraftKings',150),quote('Away','FanDuel',150,{providerId:'pB',upstreamId:'operatorB'})];
 const a=scanArbitrage(q,{now,bankroll:100});assert.equal(a.opportunities.length,1);
 const o=a.opportunities[0];assert.equal(o.status,'THEORETICAL_ARBITRAGE');
 assert.ok(Math.abs(o.theoreticalProfit-25)<1e-8);
 assert.ok(Math.abs(o.stakes.reduce((s,x)=>s+x.stake,0)-100)<1e-8);
 assert.equal(o.independentlyOwnedUpstreams,2);
});
test('multiple books from same aggregator are flagged as unverified',()=>{
 const a=scanArbitrage([quote('Home','DraftKings',150),quote('Away','FanDuel',150)],{now});
 assert.equal(a.opportunities[0].status,'UNVERIFIED_OPPORTUNITY');
 assert.deepEqual(a.opportunities[0].blockers,['INDEPENDENT_UPSTREAM_PROVENANCE_UNVERIFIED']);
});
test('different settlement rules and market types are never joined',()=>{
 const q=[quote('Home','DraftKings',150),quote('Away','FanDuel',150,{settlementKey:'regulation-only'})];
 assert.equal(scanArbitrage(q,{now}).opportunities.length,0);
 const q2=[quote('Home','DraftKings',150),quote('Away','Other',150,{venueType:'PREDICTION_MARKET'})];
 assert.equal(scanArbitrage(q2,{now}).opportunities.length,0);
});
test('incomplete market and stale/unknown quotes do not create arbitrage',()=>{
 assert.equal(scanArbitrage([quote('Home','DraftKings',200)],{now}).opportunities.length,0);
 assert.equal(scanArbitrage([quote('Home','DraftKings',200,{observedAt:now-3600000}),quote('Away','FanDuel',200)],{now}).opportunities.length,0);
 assert.equal(validatedQuote(quote('Home','DraftKings',200,{upstreamId:''}),{now}).ok,false);
});
test('profitable-looking but model-uncalibrated edges remain not actionable',()=>{
 const quotes=[quote('Home','DraftKings',150),quote('Home','FanDuel',135,{upstreamId:'operatorB',providerId:'pB'})];
 const a=screenValueEdges(quotes,[{eventId:base.eventId,marketKey:base.marketKey,selection:'Home',probability:.5,modelType:'INDEPENDENT',sourceAudited:true}],{now});
 assert.equal(a.results.length,1);assert.equal(a.results[0].status,'NOT_ACTIONABLE');
 assert.ok(a.results[0].blockers.includes('INDEPENDENT_MODEL_CALIBRATION_MISSING'));
 assert.ok(Math.abs(a.results[0].expectedRoi-25)<1e-8);
});
test('verified independent sources with calibrated model can become review candidates',()=>{
 const quotes=[quote('Home','DraftKings',150),quote('Home','FanDuel',135,{upstreamId:'operatorB',providerId:'pB'})];
 const a=screenValueEdges(quotes,[{eventId:base.eventId,marketKey:base.marketKey,selection:'Home',probability:.5,modelType:'CALIBRATED',outOfSampleVerified:true,sourceAudited:true}],{now});
 assert.equal(a.results[0].status,'CANDIDATE_FOR_FURTHER_REVIEW');assert.equal(a.networkRequests,0);
});
