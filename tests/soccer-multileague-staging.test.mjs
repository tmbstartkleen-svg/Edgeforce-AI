import test from 'node:test';
import assert from 'node:assert/strict';
import {previewSoccerLeagueBatches} from '../src/lib/intelligence-core/soccer-d1-event-preview.mjs';

test('multi-league preview preserves all observed fixtures and identifies missing leagues',()=>{
 const events=Array.from({length:55},(_,i)=>({id:String(i+1),date:'2026-10-20T19:00:00Z'}));
 const o=previewSoccerLeagueBatches([{leagueId:'eng.1',observedAt:'2026-10-19T18:00:00.000Z',raw:{events}},
  {leagueId:'esp.1',observedAt:'2026-10-19T18:00:00.000Z',raw:{events:[{id:'99',date:'2026-10-20T20:00:00Z'}]}}],
 {expectedLeagueIds:['eng.1','esp.1','ger.1']});
 assert.deepEqual(o.missingLeagueIds,['ger.1']);
 assert.deepEqual(o.leagues.map(x=>x.fixtureCount),[55,1,0]);
 assert.deepEqual(o.batches.map(x=>x.items.length),[25,25,5,1]);
 assert.equal(new Set(o.batches.flatMap(x=>x.items.map(i=>i.id))).size,56);
 assert.equal(o.sportsbookOddsAvailable,false);
 assert.equal(o.draftKingsInventoryCertified,false);
 assert.ok(o.batches.every(x=>x.previewOnly&&x.items.every(item=>item.source==='espn-public-scoreboard')));
});
