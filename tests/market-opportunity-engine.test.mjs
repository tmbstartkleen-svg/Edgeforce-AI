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
 const a=screenValueEdges(quotes,[{...base,selection:'Home',probability:.5,modelType:'INDEPENDENT',sourceAudited:true}],{now});
 assert.equal(a.results.length,1);assert.equal(a.results[0].status,'NOT_ACTIONABLE');
 assert.ok(a.results[0].blockers.includes('INDEPENDENT_MODEL_CALIBRATION_MISSING'));
 assert.ok(Math.abs(a.results[0].expectedRoi-25)<1e-8);
});
test('verified independent sources with calibrated model can become review candidates',()=>{
 const quotes=[quote('Home','DraftKings',150),quote('Home','FanDuel',135,{upstreamId:'operatorB',providerId:'pB'})];
 const a=screenValueEdges(quotes,[{...base,selection:'Home',probability:.5,modelType:'CALIBRATED',outOfSampleVerified:true,sourceAudited:true}],{now});
 assert.equal(a.results[0].status,'CANDIDATE_FOR_FURTHER_REVIEW');assert.equal(a.networkRequests,0);
});

const calibratedForecast={...base,selection:'Home',probability:.5,modelType:'CALIBRATED',outOfSampleVerified:true,sourceAudited:true};
const corroboratingQuote=()=>quote('Home','FanDuel',135,{upstreamId:'operatorB',providerId:'pB'});

test('conflicting latest target quotes withhold the price and edge regardless of input order',()=>{
 const quotes=[quote('Home','DraftKings',150),quote('Home','draftkings',-200),corroboratingQuote()];
 const forward=screenValueEdges(quotes,[calibratedForecast],{now});
 const reverse=screenValueEdges([...quotes].reverse(),[calibratedForecast],{now});
 assert.deepEqual(forward,reverse);
 assert.equal(forward.results.length,1);
 const result=forward.results[0];
 assert.equal(result.status,'NOT_ACTIONABLE');
 assert.deepEqual(result.blockers,['CONFLICTING_LATEST_TARGET_QUOTES']);
 for(const field of ['odds','breakEvenProbability','edgePercentagePoints','expectedRoi'])assert.equal(result[field],null);
 assert.equal(result.sourceObservedAt,now);
 assert.equal(result.execution,'NONE');
 assert.equal(result.productionBetRecommendationAuthorized,false);
});

test('identical latest target prices remain usable across repeated observations',()=>{
 const target=quote('Home','DraftKings',150);
 const result=screenValueEdges([target,{...target},corroboratingQuote()],[calibratedForecast],{now}).results[0];
 assert.equal(result.status,'CANDIDATE_FOR_FURTHER_REVIEW');
 assert.equal(result.odds,150);
 assert.equal(result.expectedRoi,25);
});

test('older target conflicts do not replace or invalidate a newer undisputed quote',()=>{
 const quotes=[quote('Home','DraftKings',150),quote('Home','DraftKings',-200,{observedAt:now-1000}),
  quote('Home','DraftKings',200,{observedAt:now-1000}),corroboratingQuote()];
 for(const ordered of [quotes,[...quotes].reverse()]){
  const result=screenValueEdges(ordered,[calibratedForecast],{now}).results[0];
  assert.equal(result.status,'CANDIDATE_FOR_FURTHER_REVIEW');
  assert.equal(result.odds,150);
  assert.equal(result.sourceObservedAt,now);
 }
});

test('invalid and stale conflicting prices cannot invalidate a valid target quote',()=>{
 const valid=[quote('Home','DraftKings',150),corroboratingQuote()];
 const invalid=[quote('Home','DraftKings',-200,{observedAt:now-1200001}),
  quote('Home','DraftKings',-200,{observedAt:now+60001}),
  quote('Home','DraftKings',-200,{providerId:''}),quote('Home','DraftKings',-80)];
 assert.deepEqual(screenValueEdges([...invalid,...valid],[calibratedForecast],{now}),
  screenValueEdges(valid,[calibratedForecast],{now}));
});

test('latest target conflicts are isolated to the exact player prop line',()=>{
 const prop={marketKey:'player_points',settlementKey:'NBA_PLAYER_POINTS_FULL_GAME',outcomes:['Over','Under'],
  lineKey:'24.5',periodKey:'FULL',playerId:'player-1',statKey:'points'};
 const forecast={...calibratedForecast,...prop,selection:'Over'};
 const quotes=[quote('Over','DraftKings',150,prop),
  quote('Over','FanDuel',135,{...prop,upstreamId:'operatorB',providerId:'pB'}),
  quote('Over','DraftKings',150,{...prop,lineKey:'25.5'}),
  quote('Over','DraftKings',-200,{...prop,lineKey:'25.5'})];
 for(const ordered of [quotes,[...quotes].reverse()]){
  const result=screenValueEdges(ordered,[forecast],{now}).results[0];
  assert.equal(result.status,'CANDIDATE_FOR_FURTHER_REVIEW');
  assert.equal(result.odds,150);
  const conflicting=screenValueEdges(ordered,[{...forecast,lineKey:'25.5'}],{now}).results[0];
  assert.equal(conflicting.status,'NOT_ACTIONABLE');
  assert.deepEqual(conflicting.blockers,['CONFLICTING_LATEST_TARGET_QUOTES']);
 }
});
