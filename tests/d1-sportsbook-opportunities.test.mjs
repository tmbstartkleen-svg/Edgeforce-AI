import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scanArbitrage,validatedQuote} from '../src/lib/intelligence-core/market-opportunity-engine.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const now=Date.now();
const b={eventId:'nba-fixture-1',marketKey:'player_points',settlementKey:'NBA_FULL_GAME_PLUS_OVERTIME',currency:'USD',venueType:'SPORTSBOOK',side:'BACK',outcomeSetType:'TWO_WAY',outcomes:['Over','Under'],observedAt:now-5000,playerId:'player-123',statKey:'points',periodKey:'FULL',lineKey:'24.5'};
const q=(selection,bookmaker,odds,extra={})=>({...b,selection,bookmaker,odds,upstreamId:bookmaker,providerId:bookmaker,...extra});
test('different player-prop thresholds must not create artificial arbitrage',()=>{
 const a=scanArbitrage([q('Over','DraftKings',150),q('Under','FanDuel',150,{lineKey:'25.5'})],{now});
 assert.equal(a.opportunities.length,0);assert.equal(a.blocked.length,2);
});
test('different players must never be combined into same market',()=>{
 assert.equal(scanArbitrage([q('Over','DraftKings',150),q('Under','FanDuel',150,{playerId:'player-999'})],{now}).opportunities.length,0);
});
test('same line outcome set and independent books allow theoretical arb only',()=>{
 const a=scanArbitrage([q('Over','DraftKings',150),q('Under','FanDuel',150)],{now});
 assert.equal(a.opportunities.length,1);assert.equal(a.opportunities[0].status,'THEORETICAL_ARBITRAGE');
 assert.ok(Math.abs(a.opportunities[0].theoreticalProfit-25)<1e-7);
});
test('missing prop period/player/stat/line is rejected before analysis',()=>{
 assert.equal(validatedQuote(q('Over','DraftKings',130,{lineKey:undefined}),{now}).ok,false);
 assert.equal(validatedQuote(q('Over','DraftKings',130,{statKey:undefined}),{now}).ok,false);
});
test('Worker verifies approved source identity, archived-original price and source time',()=>{
 const code=read('worker/d1-sportsbook-opportunity-review.ts');
 assert.match(code,/allowed|permitted\.get\(row\.source_id\)!==row\.upstream_id/);
 assert.match(code,/raw\.observedAt!==observedAt/);
 assert.match(code,/raw\.settlementKey/);assert.match(code,/UNVERIFIED_SETTLEMENT_OR_OUTCOMES/);
 assert.match(code,/source_observed_at>=\?/);
 assert.match(code,/modelVerifiedEdges:\[\]/);
 assert.match(code,/oddsApiCreditsSpent:0/);
 assert.doesNotMatch(code,/fetch\(/);
});
test('Cloudflare production routes source-backed D1 review',()=>{
 const code=read('worker/index.ts');assert.match(code,/d1SportsbookOpportunityReview\(request,env\)/);
});
