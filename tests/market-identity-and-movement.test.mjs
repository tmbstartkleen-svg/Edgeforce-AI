import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalMarketIdentity,lineMovementSeries,matchedNoVig} from '../src/lib/intelligence-core/market-identity-and-movement.mjs';
const now=Date.now(),base={eventId:'game1',marketKey:'moneyline',settlementKey:'game-includes-OT',selection:'Home',
 bookmaker:'DraftKings',providerId:'oddsapi',upstreamId:'upstreamA',observedAt:now-60000,odds:-110,outcomes:['Home','Away']};
test('moneyline identity allows a full-game straight price',()=>{
 assert.equal(canonicalMarketIdentity(base).ok,true);
});
test('player props demand canonical line period player and stat',()=>{
 const p={...base,marketKey:'player_points',selection:'Over'};
 assert.equal(canonicalMarketIdentity(p).reason,'DERIVATIVE_LINE_IDENTITY_REQUIRED');
 assert.equal(canonicalMarketIdentity({...p,lineKey:'22.5',periodKey:'FULL'}).reason,'PLAYER_IDENTITY_REQUIRED');
 assert.equal(canonicalMarketIdentity({...p,lineKey:'22.5',periodKey:'FULL',playerId:'p123'}).reason,'PLAYER_STAT_REQUIRED');
 assert.equal(canonicalMarketIdentity({...p,lineKey:'22.5',periodKey:'FULL',playerId:'p123',statKey:'points'}).ok,true);
});
test('movement series never blends books, sources or prop lines',()=>{
 const q=[base,{...base,odds:100,observedAt:now-1000},{...base,bookmaker:'FanDuel',odds:-115},
  {...base,marketKey:'player_points',lineKey:'22.5',periodKey:'FULL',playerId:'p123',statKey:'points'},
  {...base,marketKey:'player_points',lineKey:'23.5',periodKey:'FULL',playerId:'p123',statKey:'points'}];
 const r=lineMovementSeries(q,{now});
 assert.equal(r.series.length,4);
 const dk=r.series.find(x=>x.bookmaker==='DraftKings'&&x.marketKey==='moneyline');
 assert.equal(dk.observations,2);assert.equal(dk.latestOdds,100);assert.equal(dk.lineMoved,true);
});
test('same timestamp contradictory price is rejected instead of creating a movement',()=>{
 const r=lineMovementSeries([base,{...base,odds:120}],{now});
 assert.equal(r.series.length,0);assert.equal(r.rejectionReasons.CONFLICTING_SAME_TIMESTAMP_QUOTES,1);
});
test('complete same-book same-time two-way market receives no-vig probabilities',()=>{
 const r=matchedNoVig([base,{...base,selection:'Away',odds:-110}],{now});
 assert.equal(r.results.length,1);assert.ok(Math.abs(r.results[0].probabilities[0].noVigProbability-.5)<1e-10);
});
test('incomplete or mismatched timestamp outcome sets never receive no-vig',()=>{
 assert.equal(matchedNoVig([base],{now}).results.length,0);
 assert.equal(matchedNoVig([base,{...base,selection:'Away',observedAt:now-50000}],{now}).results.length,0);
});
