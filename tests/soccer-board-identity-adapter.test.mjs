import test from 'node:test';import assert from 'node:assert/strict';
import {resolveSoccerBoardMarkets} from '../src/lib/intelligence-core/soccer-board-identity-adapter.mjs';
const row={id:'m1',sport:'Soccer',canonicalLeagueId:'eng.1',sourceEventId:'123',sourceBook:'DraftKings'};
const now=Date.parse('2026-10-14T20:00:00Z');
const score={leagueId:'eng.1',eventId:'123',sourceApproved:true,observedAt:'2026-10-14T19:59:30Z'};
const quote={leagueId:'eng.1',eventId:'123',marketId:'m1',book:'DraftKings',licensed:true,providerApproved:true,observedAt:'2026-10-14T19:59:30Z'};
test('defaults to withholding soccer but preserves NFL',()=>{const r=resolveSoccerBoardMarkets([row,{id:'n',sport:'NFL'}]);assert.equal(r.withheldSoccerCount,1);assert.deepEqual(r.eligible.map(x=>x.id),['n']);});
test('only explicit fresh authorized score and quote restore a soccer market',()=>{const r=resolveSoccerBoardMarkets([row],{scores:[score],quotes:[quote],now});assert.equal(r.approvedSoccerCount,1);assert.equal(r.eligible[0].id,'m1');});
test('missing canonical competition id remains withheld',()=>{const r=resolveSoccerBoardMarkets([{...row,canonicalLeagueId:undefined}],{scores:[score],quotes:[quote],now});assert.equal(r.approvedSoccerCount,0)});
