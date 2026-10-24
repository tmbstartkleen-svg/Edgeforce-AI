import test from 'node:test';
import assert from 'node:assert/strict';
import {planSportsNetwork,auditMarketObservations,evaluateVerifiedEdge,NETWORK_LANES} from '../src/lib/intelligence-core/sports-network-engine.mjs';
test('covers all supported sports with specialized data collection lanes',()=>{
 assert.ok(NETWORK_LANES.length>=10);
 const p=planSportsNetwork({sports:['NFL','SOCCER','TENNIS'],budgetCredits:10});
 assert.equal(p.jobs.length,0);assert.ok(p.missing.length>=30);assert.equal(p.networkRequests,0);
});
test('licensed enabled adapters only; reserves strict maximum budget',()=>{
 const sources=[{sourceId:'verified-feed',upstreamId:'upstream-A',enabled:true,licenseApproved:true,sports:['SOCCER','NBA'],lanes:['ODDS','PLAYER_PROPS'],creditCost:2},
 {sourceId:'unapproved',upstreamId:'upstream-B',enabled:true,licenseApproved:false,sports:['SOCCER'],lanes:['ODDS'],creditCost:1}];
 const plan=planSportsNetwork({sources,sports:['SOCCER','NBA'],lanes:['ODDS','PLAYER_PROPS'],budgetCredits:5,maxJobs:4,now:100000000});
 assert.equal(plan.jobs.length,2);assert.equal(plan.reservedCredits,4);assert.equal(plan.remainingCredits,1);
 assert.ok(plan.jobs.every(j=>j.sourceId==='verified-feed'&&j.status==='PROPOSED_ONLY'));
 assert.equal(plan.executionStarted,false);
});
test('fresh jobs are not re-collected until their interval expires',()=>{
 const s={sourceId:'s',upstreamId:'u',enabled:true,licenseApproved:true,sports:['NHL'],lanes:['ODDS']};
 const p=planSportsNetwork({sources:[s],sports:['NHL'],lanes:['ODDS'],budgetCredits:5,now:2000000,lastCollected:{'s:NHL:ODDS':1999000}});
 assert.equal(p.jobs.length,0);assert.equal(p.rejected[0].reason,'FRESH_ENOUGH_ALREADY');
});
test('single aggregator with many sportsbooks is not independent upstream consensus',()=>{
 const now=Date.now();const fields={providerId:'aggregator',upstreamId:'one-owner',eventId:'game',marketKey:'ml',selectionKey:'A',observedAt:now};
 const a=auditMarketObservations([{...fields,bookmaker:'DraftKings',odds:-110},{...fields,bookmaker:'FanDuel',odds:-120}],{now});
 assert.equal(a.markets[0].independentUpstreamCount,1);assert.equal(a.markets[0].eligibleForTargetBookAnalysis,false);
 const b=auditMarketObservations([{...fields,bookmaker:'DraftKings',odds:-110},{...fields,upstreamId:'second-owner',providerId:'second-feed',bookmaker:'FanDuel',odds:-120}],{now});
 assert.equal(b.markets[0].eligibleForTargetBookAnalysis,true);
});
test('stale missing source attribution and future quotes fail closed',()=>{
 const now=Date.now();const fields={providerId:'x',upstreamId:'u',eventId:'g',marketKey:'ml',selectionKey:'A',bookmaker:'DraftKings',odds:150};
 const r=auditMarketObservations([{...fields,observedAt:now-2000000},{...fields,observedAt:now+120000},{...fields,upstreamId:'',observedAt:now}],{now});
 assert.equal(r.accepted,0);assert.equal(r.rejected,3);assert.equal(r.pricesInvented,0);
});
test('expected ROI and edge are calculated, but cannot claim approved picks without evidence',()=>{
 const e=evaluateVerifiedEdge({americanOdds:150,modelProbability:.5});
 assert.ok(Math.abs(e.breakEvenProbability-.4)<1e-10);assert.ok(Math.abs(e.expectedRoi-25)<1e-10);
 assert.ok(Math.abs(e.edgePercentagePoints-10)<1e-10);assert.equal(e.status,'NOT_ACTIONABLE');
 assert.equal(evaluateVerifiedEdge({americanOdds:-110,modelProbability:.52,modelCalibrated:true,sourceAudited:true,independentUpstreams:2,targetBookObserved:true}).status,'NOT_ACTIONABLE');
});
