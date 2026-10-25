import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFreeSportsApi} from '../src/lib/intelligence-core/free-sports-api.mjs';
const token='test-only-operator-token-123456789';
const request=(path,auth=token)=>new Request('http://localhost/api/sports/v1/'+path,{headers:{authorization:'Bearer '+auth}});
test('authentication and configuration fail closed without upstream calls',async()=>{
 let calls=0;const api=createFreeSportsApi({operatorToken:token,fetchImpl:async()=>{calls++}});
 assert.equal((await api(request('events','wrong'))).status,401);
 assert.equal((await api(request('events'))).status,503);
 const coverage=await(await api(request('coverage'))).json();assert.equal(coverage.configured,false);assert.equal(coverage.connectionVerified,false);assert.equal(calls,0);
});
test('one quota across endpoints; cache preserves retrieval time and consensus identity',async()=>{
 let time=100000,calls=0;const api=createFreeSportsApi({apiKey:'secret',operatorToken:token,now:()=>time,fetchImpl:async url=>{calls++;assert.equal(url.searchParams.get('bookmaker_key'),'betstack');return Response.json([{id:1}])}});
 const first=await(await api(request('lines?league_key=basketball_nba'))).json();
 time+=1000;const second=await(await api(request('lines?league_key=basketball_nba'))).json();
 assert.equal(second.cached,true);assert.equal(second.receivedAt,first.receivedAt);assert.equal(second.bookmakerExecutable,false);
 assert.equal((await api(request('events'))).status,429);assert.equal(calls,1);
 time+=60000;assert.equal((await api(request('lines'))).status,200);assert.equal(calls,2);
});
test('rejects arbitrary endpoints, book overrides, duplicate parameters and invalid dates',async()=>{
 const api=createFreeSportsApi({apiKey:'secret',operatorToken:token,fetchImpl:()=>assert.fail('must not fetch')});
 for(const path of ['events?date=2026-02-30','lines?bookmaker_key=draftkings','events?league_key=nfl&league_key=nba','events?url=https://evil.test'])assert.equal((await api(request(path))).status,400);
 assert.equal((await api(request('secrets'))).status,404);
});
test('upstream failure is sanitized and does not reset cooldown',async()=>{
 const api=createFreeSportsApi({apiKey:'secret',operatorToken:token,fetchImpl:async()=>new Response('private secret',{status:401})});
 const response=await api(request('sports'));assert.equal(response.status,502);assert.equal((await response.text()).includes('private secret'),false);
 assert.equal((await api(request('leagues'))).status,429);
});
test('concurrent requests share quota and Retry-After extends it',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve});
 const api=createFreeSportsApi({apiKey:'secret',operatorToken:token,now:()=>100000,fetchImpl:async()=>{await pending;return new Response(null,{status:429,headers:{'Retry-After':'120'}})}});
 const first=api(request('sports'));assert.equal((await api(request('leagues'))).status,429);release();
 assert.equal((await first).headers.get('retry-after'),'120');assert.equal((await api(request('events'))).headers.get('retry-after'),'120');
});

test('rejects stale or wrong-league schedules instead of presenting them as requested games',async()=>{
 for(const event of [
  {league:{key:'basketball_nbl'},commence_time:'2026-10-26T12:00:00Z'},
  {league:{key:'basketball_nba'},commence_time:'2025-11-01T12:00:00Z'},
  {league:{key:'basketball_nba'},commence_time:null},
  null
 ]){
  const api=createFreeSportsApi({apiKey:'secret',operatorToken:token,fetchImpl:async()=>Response.json([event])});
  const r=await api(request('events?league_key=basketball_nba&date=2026-10-26'));
  assert.equal(r.status,502);assert.equal((await r.json()).error,'UPSTREAM_SCHEDULE_FILTER_MISMATCH');
 }
 const api=createFreeSportsApi({apiKey:'secret',operatorToken:token,fetchImpl:async()=>Response.json([{league:{key:'basketball_nba'},commence_time:'2026-10-26T12:00:00Z'}])});
 assert.equal((await api(request('events?league_key=basketball_nba&date=2026-10-26'))).status,200);
});
