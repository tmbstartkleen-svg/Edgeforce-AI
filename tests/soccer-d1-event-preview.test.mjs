import test from 'node:test';import assert from 'node:assert/strict';
import {previewSoccerD1Events} from '../src/lib/intelligence-core/soccer-d1-event-preview.mjs';
test('public fixtures are D1-shaped but cannot claim sportsbook market evidence',()=>{
 const observedAt='2026-10-19T18:00:00.000Z';
 const data={events:[{id:'123',date:'2026-10-20T19:00:00Z'},{id:'123',date:'2026-10-20T19:00:00Z'}]};
 const result=previewSoccerD1Events(data,{leagueId:'eng.1',observedAt});
 assert.equal(result.previewOnly,true);assert.equal(result.sportsbookOddsAvailable,false);
 assert.equal(result.draftKingsInventoryCertified,false);assert.equal(result.items.length,1);
 assert.deepEqual(result.items[0],{id:'espn:eng.1:123',provider_event_id:'espn:eng.1:123',sport:'soccer',league:'eng.1',start_time:'2026-10-20T19:00:00.000Z',source:'espn-public-scoreboard',observed_at:observedAt,status:'unverified-public-fixture'});
});
test('preview never exceeds ingestion batch limit',()=>{
 const events=Array.from({length:30},(_,i)=>({id:String(i+1),date:'2026-10-20T19:00:00Z'}));
 const output=previewSoccerD1Events({events},{leagueId:'eng.1',observedAt:'2026-10-19T18:00:00.000Z'});
 assert.equal(output.items.length,25);assert.equal(output.totalObserved,30);assert.equal(output.truncated,true);
});
