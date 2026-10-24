import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOddsPayload} from '../src/lib/providers/normalizeOdds.ts';
test('flat odds without source observation timestamp are not reported as fresh',()=>{
 const r=normalizeOddsPayload([{id:'e1',sport:'NBA',eventId:'evt1',home:'A',away:'B',selection:'A',market:'h2h',startTime:'2026-10-25T00:00:00Z',odds:-110}]);
 assert.equal(r.markets.length,1);assert.equal(r.markets[0].sourceAgeMin,Infinity);assert.equal(r.markets[0].sourceTimestamp,undefined);assert.equal(r.markets[0].sourceEventId,'evt1');
});
test('flat odds preserve explicit provider timestamp',()=>{
 const timestamp=new Date(Date.now()-120000).toISOString();const r=normalizeOddsPayload([{id:'e1',sport:'NBA',eventId:'evt1',home:'A',away:'B',selection:'A',market:'h2h',startTime:'2026-10-25T00:00:00Z',odds:-110,sourceTimestamp:timestamp}]);assert.equal(r.markets[0].sourceTimestamp,timestamp);assert.ok(r.markets[0].sourceAgeMin>=1.9);
});
test('nested sportsbook payload retains provider quote update timestamp',()=>{
 const timestamp=new Date(Date.now()-60000).toISOString();const r=normalizeOddsPayload([{id:'e1',sport_title:'NBA',home_team:'A',away_team:'B',commence_time:'2026-10-25T00:00:00Z',bookmakers:[{key:'book1',title:'Book',last_update:timestamp,markets:[{key:'h2h',last_update:timestamp,outcomes:[{name:'A',price:-110},{name:'B',price:100}]}]}]}]);assert.equal(r.markets.length,2);assert.ok(r.markets.every(m=>m.sourceTimestamp===timestamp));assert.ok(r.markets.every(m=>m.sourceEventId==='e1'));
});
