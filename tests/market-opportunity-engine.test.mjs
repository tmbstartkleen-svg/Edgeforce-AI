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
test('a newer bookmaker price supersedes a favorable historical price before arbitrage arithmetic',()=>{
 const inputs=[quote('Home','DraftKings',150,{observedAt:now-60000}),
  quote('Home','DraftKings',-200),quote('Away','FanDuel',110,{upstreamId:'operatorB',providerId:'pB'})];
 for(const quotes of [inputs,[...inputs].reverse()]){
  const report=scanArbitrage(quotes,{now});
  assert.equal(report.opportunities.length,0);
  assert.equal(report.ordersPlaced,0);
  assert.equal(report.externalRequests,0);
 }
});
test('remaining arbitrage uses the latest source prices and preserves their observation times',()=>{
 const quotes=[quote('Home','DraftKings',300,{observedAt:now-60000}),
  quote('Home','DraftKings',150,{observedAt:now-1000}),
  quote('Away','FanDuel',150,{upstreamId:'operatorB',providerId:'pB',observedAt:now-2000})];
 const report=scanArbitrage(quotes,{now,bankroll:100});
 assert.deepEqual(report,scanArbitrage([...quotes].reverse(),{now,bankroll:100}));
 assert.equal(report.opportunities.length,1);
 const opportunity=report.opportunities[0];
 assert.equal(opportunity.theoreticalProfit,25);
 const home=opportunity.stakes.find(x=>x.selection==='Home');
 const away=opportunity.stakes.find(x=>x.selection==='Away');
 assert.equal(home.odds,150);assert.equal(home.observedAt,now-1000);
 assert.equal(away.odds,150);assert.equal(away.observedAt,now-2000);
});
test('conflicting latest bookmaker prices cannot fall back to an old price or input order',()=>{
 const quotes=[quote('Home','DraftKings',300,{observedAt:now-60000}),
  quote('Home','DraftKings',150),quote('Home','draftkings',-200,{providerId:'second-feed'}),
  quote('Away','FanDuel',150,{upstreamId:'operatorB',providerId:'pB'})];
 const report=scanArbitrage(quotes,{now});
 assert.deepEqual(report,scanArbitrage([...quotes].reverse(),{now}));
 assert.equal(report.opportunities.length,0);
 const conflicts=report.blocked.filter(x=>x.reason==='CONFLICTING_LATEST_BOOKMAKER_QUOTES');
 assert.equal(conflicts.length,1);
 assert.equal(conflicts[0].bookmaker,'draftkings');
 assert.equal(conflicts[0].selection,'Home');
 assert.equal(conflicts[0].observedAt,now);
 assert.ok(report.blocked.some(x=>x.reason==='INCOMPLETE_OUTCOME_COVERAGE'));
});
test('a newer unambiguous quote supersedes historical conflicts and identical latest duplicates remain usable',()=>{
 const current=quote('Home','DraftKings',150);
 const other=quote('Away','FanDuel',150,{upstreamId:'operatorB',providerId:'pB'});
 const quotes=[quote('Home','DraftKings',300,{observedAt:now-1000}),
  quote('Home','DraftKings',-200,{observedAt:now-1000}),current,{...current},other,{...other}];
 const expected=scanArbitrage([current,other],{now});
 assert.deepEqual(scanArbitrage(quotes,{now}),expected);
 assert.deepEqual(scanArbitrage([...quotes].reverse(),{now}),expected);
 assert.equal(expected.opportunities.length,1);
 assert.equal(expected.blocked.length,0);
});
test('unambiguous alternative venues may form arbitrage while a conflicted venue stays excluded',()=>{
 const quotes=[quote('Home','DraftKings',500),quote('Home','DraftKings',-1000),
  quote('Home','Pinnacle',150,{providerId:'pC',upstreamId:'operatorC'}),
  quote('Away','FanDuel',150,{providerId:'pB',upstreamId:'operatorB'})];
 const report=scanArbitrage(quotes,{now});
 assert.deepEqual(report,scanArbitrage([...quotes].reverse(),{now}));
 assert.equal(report.opportunities.length,1);
 assert.equal(report.opportunities[0].theoreticalProfit,25);
 assert.deepEqual(report.opportunities[0].stakes.map(x=>x.bookmaker).sort(),['FanDuel','Pinnacle']);
 assert.equal(report.blocked.filter(x=>x.reason==='CONFLICTING_LATEST_BOOKMAKER_QUOTES').length,1);
 assert.equal(report.ordersPlaced,0);
});
test('bookmaker capitalization cannot create a second independent venue',()=>{
 const report=scanArbitrage([quote('Home','DraftKings',150),
  quote('Away','draftkings',150,{providerId:'pB',upstreamId:'operatorB'})],{now});
 assert.equal(report.opportunities.length,0);
 assert.ok(report.blocked.some(x=>x.reason==='ONE_VENUE_NOT_ARBITRAGE'));
});
test('latest prices and arbitrage coverage stay isolated by complete contract, sport, side and venue identity',()=>{
 const prop={sport:'NBA',marketKey:'player_points',settlementKey:'NBA_PLAYER_POINTS_FULL_GAME',
  outcomes:['Over','Under'],lineKey:'24.5',periodKey:'FULL',playerId:'player-1',statKey:'points'};
 const over=quote('Over','DraftKings',150,{...prop,observedAt:now-1000});
 const under=quote('Under','FanDuel',150,{...prop,upstreamId:'operatorB',providerId:'pB',observedAt:now-1000});
 for(const difference of [
  {eventId:'another-event'},{settlementKey:'REGULATION_ONLY'},{lineKey:'25.5'},{periodKey:'FIRST_HALF'},
  {playerId:'player-2'},{statKey:'assists'},{sport:'WNBA'},{currency:'EUR'},{side:'YES'},
  {venueType:'PREDICTION_MARKET'},{outcomeSetType:'THREE_WAY',outcomes:['Over','Under','Push']}
 ]){
  assert.equal(scanArbitrage([over,{...under,...difference}],{now}).opportunities.length,0,JSON.stringify(difference));
  const conflictingOtherContract=[{...over,...difference,odds:-200,observedAt:now},
   {...over,...difference,odds:500,observedAt:now}];
  const report=scanArbitrage([over,under,...conflictingOtherContract],{now});
  assert.equal(report.opportunities.length,1,JSON.stringify(difference));
  assert.equal(report.opportunities[0].theoreticalProfit,25);
  assert.equal(report.opportunities[0].stakes.find(x=>x.selection==='Over').observedAt,now-1000);
 }
});
test('three-way arbitrage also excludes prices superseded within one outcome',()=>{
 const market={sport:'Soccer',outcomes:['Home','Draw','Away'],outcomeSetType:'THREE_WAY'};
 const quotes=[quote('Home','DraftKings',300,market),
  quote('Draw','FanDuel',300,{...market,providerId:'pB',upstreamId:'operatorB',observedAt:now-60000}),
  quote('Away','Pinnacle',300,{...market,providerId:'pC',upstreamId:'operatorC'})];
 assert.equal(scanArbitrage(quotes,{now}).opportunities.length,1);
 quotes.push(quote('Draw','FanDuel',-200,{...market,providerId:'pB',upstreamId:'operatorB'}));
 assert.equal(scanArbitrage(quotes,{now}).opportunities.length,0);
 assert.equal(scanArbitrage([...quotes].reverse(),{now}).opportunities.length,0);
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
