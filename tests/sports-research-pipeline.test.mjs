import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSportsResearchPipeline} from '../src/lib/intelligence-core/sports-research-pipeline.mjs';
import {screenValueEdges,validatedQuote} from '../src/lib/intelligence-core/market-opportunity-engine.mjs';

// Synthetic fixtures test arithmetic and rejection behavior, not real games or model results.
const now=Date.parse('2026-11-10T01:00:00Z');
const base={sport:'nba',eventId:'fixture-event',marketKey:'full-game-moneyline',settlementKey:'full-plus-ot',
 marketStatus:'OPEN',eventStatus:'UPCOMING',eventStartsAt:new Date(now+3600000).toISOString(),
 currency:'USD',venueType:'SPORTSBOOK',side:'BACK',outcomeSetType:'TWO_WAY',outcomes:['Home','Away'],
 selection:'Home',providerId:'fixture-provider-a',upstreamId:'fixture-owner-a',
 bookmaker:'DraftKings',observedAt:now-1000,odds:120};
const quotesFor=(q=base)=>[q,{...q,bookmaker:'fixture-other-book',providerId:'fixture-provider-b',upstreamId:'fixture-owner-b'}];
const modelFor=(q=base)=>({...q,modelId:'fixture-model',modelVersion:'fixture-v1',
 generatedAt:new Date(now-2000).toISOString(),trainingCutoff:new Date(now-86400000).toISOString(),
 inputReferences:['fixture:stats'],calibrationReference:'fixture:calibration',holdoutReference:'fixture:holdout',
 availabilityReferences:['fixture:lineup'],modelType:'CALIBRATED',probability:.60,
 outOfSampleVerified:true,sourceAudited:true,lineupStatus:'CONFIRMED',
 scenarios:[{weight:.7,probability:.62},{weight:.3,probability:.57}]});
const build=(input)=>buildSportsResearchPipeline(input,{now});

test('quotes without an independent model retain break-even and report the evidence gap',()=>{
 const r=build({quotes:quotesFor()});
 assert.equal(r.records.length,1);
 assert.equal(r.records[0].breakEvenProbability,1/2.2);
 assert.equal(r.records[0].scenarioAnalysis,null);
 assert.ok(r.records[0].blockers.includes('EXACT_MODEL_FORECAST_MISSING'));
 assert.equal(r.records[0].status,'RESEARCH_ONLY');
 assert.equal(r.externalRequests+r.databaseWrites+r.ordersPlaced,0);
});
test('complete supplied model evidence produces review only and preserves model and source references',()=>{
 const row=build({quotes:quotesFor(),forecasts:[modelFor()]}).records[0];
 assert.equal(row.status,'CANDIDATE_REQUIRES_INDEPENDENT_VERIFICATION');
 assert.equal(row.sourceAuthenticityCertified,false);
 assert.equal(row.productionBetRecommendationAuthorized,false);
 assert.equal(row.model.version,'fixture-v1');
 assert.equal(row.slipUrl,null);
 const p=row.scenarioAnalysis.scenarioAdjustedProbability;
 assert.ok(Math.abs(row.scenarioAnalysis.edge-(p-1/2.2))<1e-12);
 assert.ok(Math.abs(row.scenarioAnalysis.conservativeExpectedRoi-(p*2.2-1))<1e-12);
});
test('models for another settlement, currency, selection or outcome set cannot attach',()=>{
 for(const edits of [{settlementKey:'regulation-only'},{currency:'EUR'},{selection:'Away'},
  {outcomes:['Home','Away','Draw'],outcomeSetType:'THREE_WAY'}]){
  const row=build({quotes:quotesFor(),forecasts:[{...modelFor(),...edits}]}).records[0];
  assert.equal(row.model,null);
  assert.equal(row.status,'RESEARCH_ONLY');
  assert.equal(screenValueEdges(quotesFor(),[{...modelFor(),...edits}],{now}).results.length,0);
 }
});
test('consensus cannot borrow invalid, stale, mismatched or one-owner observations',()=>{
 for(const edits of [{upstreamId:base.upstreamId},{settlementKey:'regulation-only'},
  {currency:'EUR'},{observedAt:now-3600000},{odds:90},{outcomes:['Home','Away','Draw'],outcomeSetType:'THREE_WAY'}]){
  const quotes=[base,{...quotesFor()[1],...edits}];
  const row=build({quotes,forecasts:[modelFor()]}).records[0];
  assert.ok(row.blockers.includes('INDEPENDENT_UPSTREAM_CONSENSUS_MISSING'));
  const value=screenValueEdges(quotes,[modelFor()],{now}).results[0];
  assert.equal(value.status,'NOT_ACTIONABLE');
 }
});
test('same-source contradictory prices and ambiguous models fail closed',()=>{
 const quotes=[...quotesFor(),{...base,odds:150}];
 assert.ok(build({quotes,forecasts:[modelFor()]}).records[0].blockers.includes('CONFLICTING_SOURCE_QUOTES'));
 const r=build({quotes:quotesFor(),forecasts:[modelFor(),modelFor()]}).records[0];
 assert.ok(r.blockers.includes('AMBIGUOUS_MODEL_FORECASTS'));
 assert.equal(r.scenarioAnalysis,null);
});
test('uncalibrated, stale, missing-version and missing-input models stay research only',()=>{
 for(const edits of [{modelType:'INDEPENDENT'},{outOfSampleVerified:false},{sourceAudited:false},
  {generatedAt:new Date(now-3600000).toISOString()},{generatedAt:new Date(now+1000).toISOString()},
  {trainingCutoff:new Date(now).toISOString()},{modelVersion:''},{inputReferences:[]},
  {holdoutReference:null},{availabilityReferences:[]},{lineupStatus:'UNKNOWN'},
  {scenarios:[{weight:.5,probability:.9},{weight:.4,probability:.8}]}]){
  const row=build({quotes:quotesFor(),forecasts:[{...modelFor(),...edits}]}).records[0];
  assert.equal(row.status,'RESEARCH_ONLY');
  assert.ok(row.blockers.length>0);
 }
});
const prop={...base,marketKey:'player-assists-over',playerId:'fixture-player',statKey:'assists',
 lineKey:'assists:5.5',periodKey:'full-plus-ot',lineValue:5.5,selection:'Over',outcomes:['Over','Under']};
const research=()=>({playerId:prop.playerId,sport:'nba',stat:'assists',threshold:5.5,
 asOf:new Date(now-3000).toISOString(),games:Array.from({length:5},(_,i)=>({
  playerId:prop.playerId,eventId:'fixture-history-'+i,upstreamId:'fixture-stats-provider',
  date:new Date(now-(i+1)*86400000).toISOString(),observedAt:new Date(now-4000).toISOString(),
  completed:true,sourceUrl:'https://example.test/fixture/'+i,stats:{assists:7},
 }))});
test('player model joins include player, statistic, line and period identity',()=>{
 for(const edits of [{lineKey:'assists:6.5'},{periodKey:'first-half'},{playerId:'other-player'},{statKey:'points'}]){
  const input={quotes:quotesFor(prop),forecasts:[{...modelFor(prop),...edits}]};
  const row=build(input).records[0];
  assert.equal(row.model,null);
  assert.equal(screenValueEdges(input.quotes,input.forecasts,{now}).results.length,0);
 }
});
test('historical player hit rates never substitute for a scenario probability',()=>{
 const r=build({quotes:quotesFor(prop),playerResearch:[research()]});
 assert.equal(r.records[0].playerEvidence.snapshot.streak.last5.hitRate,1);
 assert.equal(r.records[0].scenarioAnalysis,null);
 assert.equal(r.records[0].status,'RESEARCH_ONLY');
});
test('prop research must match the athlete and threshold and precede the model',()=>{
 const valid={quotes:quotesFor(prop),forecasts:[modelFor(prop)],playerResearch:[research()]};
 assert.equal(build(valid).records[0].status,'CANDIDATE_REQUIRES_INDEPENDENT_VERIFICATION');
 for(const edits of [{playerId:'another'},{threshold:6.5},{stat:'points'},{asOf:new Date(now+1000).toISOString()},
  {asOf:new Date(now-1000).toISOString()},{games:[]}]){
  const row=build({...valid,playerResearch:[{...research(),...edits}]}).records[0];
  assert.equal(row.status,'RESEARCH_ONLY');
 }
});
test('malformed and stale quote records are excluded with reasons',()=>{
 for(const q of [null,{...base,observedAt:now-3600000},{...base,outcomes:{length:2}},
  {...base,outcomes:[{},'Home']}]){
  assert.equal(validatedQuote(q,{now}).ok,false);
  assert.equal(build({quotes:[q]}).records.length,0);
 }
 assert.throws(()=>build({quotes:new Array(10001).fill(base)}),/INVALID_RESEARCH_PIPELINE/);
});
test('closed, unknown, started and stale live markets cannot qualify',()=>{
 for(const edits of [{marketStatus:'CLOSED'},{marketStatus:null},{eventStatus:'FINAL'},
  {eventStartsAt:new Date(now-1000).toISOString()},
  {eventStatus:'LIVE',eventStartsAt:new Date(now-3600000).toISOString(),observedAt:now-16000},
  {observedAt:now+1000},{sport:null}]){
  const q={...base,...edits};
  assert.equal(build({quotes:quotesFor(q),forecasts:[modelFor(q)]}).records[0].status,'RESEARCH_ONLY');
 }
 const live={...base,eventStatus:'LIVE',eventStartsAt:new Date(now-3600000).toISOString()};
 assert.equal(build({quotes:quotesFor(live),forecasts:[modelFor(live)]}).records[0].status,
  'CANDIDATE_REQUIRES_INDEPENDENT_VERIFICATION');
});
test('identical source event IDs in different sports cannot supply model or price corroboration',()=>{
 const other={...quotesFor()[1],sport:'nfl'};
 const row=build({quotes:[base,other],forecasts:[modelFor()]}).records[0];
 assert.ok(row.blockers.includes('INDEPENDENT_UPSTREAM_CONSENSUS_MISSING'));
 assert.equal(build({quotes:quotesFor(),forecasts:[{...modelFor(),sport:'nfl'}]}).records[0].model,null);
});
test('closed or time-inconsistent corroborating sources cannot qualify a candidate',()=>{
 for(const edits of [{marketStatus:'CLOSED'},{marketStatus:null},{observedAt:now+1000},
  {eventStatus:'FINAL'},{eventStartsAt:new Date(now-1000).toISOString()}]){
  const row=build({quotes:[base,{...quotesFor()[1],...edits}],forecasts:[modelFor()]}).records[0];
  assert.ok(row.blockers.includes('INDEPENDENT_UPSTREAM_CONSENSUS_MISSING'));
 }
 const row=build({quotes:quotesFor(prop),forecasts:[{...modelFor(prop),lineValue:6.5}],
  playerResearch:[research()]}).records[0];
 assert.ok(row.blockers.includes('MODEL_THRESHOLD_MISMATCH'));
});
