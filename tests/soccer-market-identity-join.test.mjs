import test from 'node:test';import assert from 'node:assert/strict';import {joinAuthorizedSoccerMarkets} from '../src/lib/intelligence-core/soccer-market-identity-join.mjs';
const now=Date.parse('2026-10-14T20:00:00Z');
const market={id:'m1',leagueId:'eng.1',eventId:'123',sourceBook:'DraftKings',sourceProviderId:'licensed'};
const score={leagueId:'eng.1',eventId:'123',sourceApproved:true,observedAt:'2026-10-14T19:59:00Z'};
const quote={leagueId:'eng.1',eventId:'123',marketId:'m1',book:'DraftKings',providerId:'licensed',licensed:true,providerApproved:true,observedAt:'2026-10-14T19:59:00Z'};
test('requires approved fresh scoreboard and licensed matching bookmaker quote',()=>{
 const x=joinAuthorizedSoccerMarkets({markets:[market],scores:[score],quotes:[quote],now});
 assert.equal(x.approved,1);assert.equal(x.results[0].reason,'VERIFIED_EVIDENCE');
});
test('rejects missing, mismatched or stale evidence',()=>{
 assert.equal(joinAuthorizedSoccerMarkets({markets:[market],scores:[score],quotes:[],now}).approved,0);
 assert.equal(joinAuthorizedSoccerMarkets({markets:[market],scores:[{...score,observedAt:'2026-10-14T19:50:00Z'}],quotes:[quote],now}).approved,0);
 assert.equal(joinAuthorizedSoccerMarkets({markets:[market],scores:[score],quotes:[{...quote,licensed:false}],now}).approved,0);
 assert.equal(joinAuthorizedSoccerMarkets({markets:[{...market,eventId:'124'}],scores:[score],quotes:[quote],now}).approved,0);
 assert.equal(joinAuthorizedSoccerMarkets({markets:[{...market,leagueId:''}],scores:[score],quotes:[quote],now}).approved,0);
});

test('provider ID must match the quoted authorized provider',()=>{const r=joinAuthorizedSoccerMarkets({markets:[{...market,sourceProviderId:'different'}],scores:[score],quotes:[quote],now});assert.equal(r.approved,0)});
