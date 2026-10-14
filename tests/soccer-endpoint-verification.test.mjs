import test from 'node:test';import assert from 'node:assert/strict';
import {probeSoccerLeague,probeSoccerLeagues} from '../scripts/soccer-endpoint-verification.mjs';
const candidate={league:'Test League',id:'soccer-test',code:'test.1'};
test('validated fixtures and no sportsbook claims',async()=>{
 const out=await probeSoccerLeague(candidate,{clock:()=>99,fetcher:async()=>({ok:true,text:async()=>JSON.stringify({events:[{id:'7',date:'2026-10-14'},{id:'8'}]})})});
 assert.equal(out.reachable,true);assert.deepEqual(out.fixtureIds,['7']);assert.equal(out.oddsLicensed,false);
});
test('bad response never interpreted as working feed',async()=>{
 const out=await probeSoccerLeague(candidate,{clock:()=>99,fetcher:async()=>({ok:true,text:async()=>JSON.stringify({error:'missing'})})});
 assert.equal(out.reachable,false);assert.equal(out.reason,'INVALID_EVENTS_SCHEMA');
});
test('summary never claims DraftKings coverage',async()=>{
 const out=await probeSoccerLeagues({candidates:[candidate],clock:()=>99,fetcher:async()=>({ok:true,text:async()=>JSON.stringify({events:[]})})});
 assert.equal(out.reachable,1);assert.equal(out.draftKingsFixturesCertified,false);
});
