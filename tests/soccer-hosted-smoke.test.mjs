import test from 'node:test';import assert from 'node:assert/strict';
import {smokeHostedSoccerFixtures} from '../scripts/soccer-hosted-smoke.mjs';
const safe={leagueId:'eng.1',classification:'PUBLIC_SCOREBOARD_ONLY',sourceApprovedForMarketRanking:false,sportsbookOddsAvailable:false,draftKingsInventoryCertified:false,fixtures:[]};
test('a deployed public fixtures endpoint must satisfy safety contract',async()=>{
 const r=await smokeHostedSoccerFixtures('https://example.test',{fetcher:async()=>({ok:true,status:200,json:async()=>safe})});
 assert.equal(r.reachable,true);assert.equal(r.licensedOddsVerified,false);
});
test('an endpoint claiming licensed odds is not certified',async()=>{
 const r=await smokeHostedSoccerFixtures('https://example.test',{fetcher:async()=>({ok:true,status:200,json:async()=>({...safe,sportsbookOddsAvailable:true}})});
 assert.equal(r.reachable,false);
});
test('a missing deployed route is reported as unavailable',async()=>{
 const r=await smokeHostedSoccerFixtures('https://example.test',{fetcher:async()=>({ok:false,status:404})});
 assert.equal(r.httpStatus,404);assert.equal(r.reachable,false);
});
