import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {loadProvider} from './helpers/load-provider.mjs';
const api=loadProvider('sharpApi',{'../db':{db:()=>null}});
const now=Date.now();
const quote=(side='home',extra={})=>({id:'quote-'+side,event_id:'event-1',sportsbook:'draftkings',sport:'basketball',league:'nba',home_team:'Home Team',away_team:'Away Team',market_type:'moneyline',selection:side==='home'?'Home Team':'Away Team',selection_type:side,odds_american:side==='home'?-110:100,line:null,is_main_line:true,is_alternate_line:false,is_live:false,event_start_time:new Date(now+3600000).toISOString(),timestamp:new Date(now-1000).toISOString(),...extra});
const snap=(rows,extra={})=>({schema:1,rows,receivedAt:now,delaySeconds:60,pages:1,truncated:false,...extra});
const response=(rows,options={})=>new Response(JSON.stringify({data:rows,pagination:{has_more:false},...options.body}),{status:options.status||200,headers:{'content-type':'application/json',...options.headers}});

test('explicit opt-in and a non-placeholder key are required',()=>{
 for(const env of [{},{SHARP_API_KEY:'private-key'},{SHARP_API_ENABLED:'true'},{SHARP_API_ENABLED:'true',SHARP_API_KEY:'[SENSITIVE]'},{SHARP_API_ENABLED:'true',SHARP_API_KEY:'bad\nkey'}])assert.equal(api.sharpApiProvider(env),null);
 const config=api.sharpApiProvider({SHARP_API_ENABLED:'true',SHARP_API_KEY:'private-key'});
 assert.equal(config.id,'sharp-api');assert.match(config.name,/delayed pregame/);assert.equal(config.maxAgeMin,5);
});
test('real flat moneyline contract produces both correctly identified teams',()=>{
 const data=api.normalizeSharpSnapshot(snap([quote(),quote('away')]),now);
 assert.equal(data.markets.length,2);assert.equal(data.markets[0].bookmaker,'DraftKings');
 assert.match(data.markets[0].id,/sharp-api:draftkings:event-1:quote-home/);
 assert.equal(data.markets[0].pulledAt,new Date(now-60000).toISOString());
 assert.equal(data.markets[0].liveEligible,false);assert.match(data.warnings[0],/60s/);
});
test('unknown, prediction-market and premium books are never relabeled',()=>{
 for(const sportsbook of ['polymarket','kalshi','pinnacle','unknown','DraftKings'])assert.equal(api.normalizeSharpSnapshot(snap([quote('home',{sportsbook}),quote('away',{sportsbook})]),now).markets.length,0);
 assert.equal(api.normalizeSharpSnapshot(snap([quote('home',{sportsbook:'fanduel'}),quote('away',{sportsbook:'fanduel'})]),now).markets[0].bookmaker,'FanDuel');
});
test('invalid numeric prices and null or missing lines never become zero or even-money',()=>{
 for(const odds_american of [null,undefined,'-110',0,99,NaN,Infinity])assert.equal(api.normalizeSharpSnapshot(snap([quote('home',{odds_american}),quote('away')]),now).markets.length,0);
 for(const line of [null,undefined,'0',0.25])assert.equal(api.normalizeSharpSnapshot(snap([quote('home',{market_type:'point_spread',line}),quote('away',{market_type:'point_spread',line})]),now).markets.length,0);
});
test('main spreads and totals require opposite sides at compatible lines',()=>{
 const spreads=[quote('home',{market_type:'point_spread',line:-3.5}),quote('away',{market_type:'point_spread',line:3.5})];
 assert.deepEqual(api.normalizeSharpSnapshot(snap(spreads),now).markets.map(x=>x.selection),['Home Team -3.5','Away Team +3.5']);
 spreads[1].line=4.5;assert.equal(api.normalizeSharpSnapshot(snap(spreads),now).markets.length,0);
 const totals=[quote('home',{id:'over',market_type:'total_points',selection_type:'over',selection:'Over',line:215.5}),quote('away',{id:'under',market_type:'total_points',selection_type:'under',selection:'Under',line:215.5})];
 assert.equal(api.normalizeSharpSnapshot(snap(totals),now).markets.length,2);
 totals[1].line=216.5;assert.equal(api.normalizeSharpSnapshot(snap(totals),now).markets.length,0);
});
test('three-way draws cannot turn into a fabricated two-way market',()=>{
 const draw=quote('away',{id:'draw',selection_type:'draw',selection:'Draw'});
 assert.equal(api.normalizeSharpSnapshot(snap([quote(),quote('away'),draw]),now).markets.length,0);
});
test('source timestamps survive cache reuse and eventually expire',()=>{
 const snapshot=snap([quote(),quote('away')]);
 const first=api.normalizeSharpSnapshot(snapshot,now),cached=api.normalizeSharpSnapshot(snapshot,now+100000);
 assert.equal(first.markets[0].pulledAt,cached.markets[0].pulledAt);
 assert.equal(api.normalizeSharpSnapshot(snapshot,now+300001).markets.length,0);
});
test('missing/future/unzoned timestamps, started events and suspended/prop/period rows reject',()=>{
 const changes=[{timestamp:undefined},{timestamp:'2026-10-06T15:30:00'},{timestamp:new Date(now+90000).toISOString()},
  {event_start_time:new Date(now+20000).toISOString()},{is_live:true},{is_live:'false'},{is_active:false},{is_active:'false'},
  {is_stale_pregame_price:true},{is_main_line:false},{is_alternate_line:true},{is_player_prop:true},{market_segment:'1st_half'},
  {market_type:'moneyline_3-way'},{market_type:'asian_handicap'},{market_type:'player_points'},{selection:'Wrong Team'}];
 for(const change of changes)assert.equal(api.normalizeSharpSnapshot(snap([quote('home',change),quote('away',change)]),now).markets.length,0,JSON.stringify(change));
});
test('duplicate quotes deduplicate; conflicting duplicate IDs reject their group',()=>{
 assert.equal(api.normalizeSharpSnapshot(snap([quote(),quote(),quote('away')]),now).markets.length,2);
 assert.equal(api.normalizeSharpSnapshot(snap([quote(),quote('home',{odds_american:-130}),quote('away')]),now).markets.length,0);
});
test('incomplete/ambiguous line cohorts and partial pagination remain explicit',()=>{
 assert.equal(api.normalizeSharpSnapshot(snap([quote()]),now).markets.length,0);
 const partial=api.normalizeSharpSnapshot(snap([quote(),quote('away')],{truncated:true,pages:4}),now);
 assert.equal(partial.coverage.complete,false);assert.match(partial.warnings.join(' '),/partial/);
});
test('HTTP loader uses the official host, header credentials and bounded cursor paging',async()=>{
 const calls=[];
 const data=await api.fetchSharpSnapshot('test-key',async(url,options)=>{
  calls.push({url:new URL(url),options});
  return response([quote(),quote('away')],{headers:{'x-data-delay':'120'},body:{pagination:{has_more:true,next_cursor:'page-'+calls.length}}});
 });
 assert.equal(calls.length,4);assert.equal(data.pages,4);assert.equal(data.truncated,true);assert.equal(data.delaySeconds,120);
 for(const call of calls){assert.equal(call.url.origin,'https://api.sharpapi.io');assert.equal(call.url.searchParams.has('api_key'),false);assert.equal(call.options.headers['X-API-Key'],'test-key');assert.equal(call.url.searchParams.get('is_live'),'false');assert.equal(call.url.searchParams.get('is_main_line'),'true');assert.equal(call.options.redirect,'error');}
 assert.equal(calls[1].url.searchParams.get('cursor'),'page-1');
});
test('HTTP 429 honors Retry-After and never retries in the same batch',async()=>{
 let calls=0;
 await assert.rejects(()=>api.fetchSharpSnapshot('secret',async()=>{calls++;return response([],{status:429,headers:{'retry-after':'180'},body:{error:{message:'secret do not reflect'}}});}),e=>e.status===429&&e.cooldownMs===180000&&!e.message.includes('secret'));
 assert.equal(calls,1);
 assert.equal(api.sharpRetryAfter(new Headers({'x-ratelimit-reset':String((now+240000)/1000)}),now),240000);
 assert.equal(api.sharpRetryAfter(new Headers({'retry-after':new Date(now+300000).toUTCString()}),now)>298000,true);
});
test('auth failures do not trigger purchases, alternate credentials or requests',async()=>{
 for(const status of [401,403]){let calls=0;await assert.rejects(()=>api.fetchSharpSnapshot('secret',async()=>{calls++;return response([],{status});}),e=>e.status===status&&e.cooldownMs===3600000);assert.equal(calls,1);}
});
test('invalid JSON, HTML, oversized responses and broken cursors fail closed',async()=>{
 for(const make of [()=>new Response('<html>secret</html>',{headers:{'content-type':'text/html'}}),()=>new Response('{bad',{headers:{'content-type':'application/json'}}),()=>new Response(' '.repeat(524289),{headers:{'content-type':'application/json'}}),()=>response([],{body:{pagination:{has_more:'true'}}}),()=>response([quote()],{body:{pagination:{has_more:true}}})])await assert.rejects(()=>api.fetchSharpSnapshot('secret',async()=>make()),e=>!e.message.includes('secret'));
});
test('warming empty store is not an authoritative no-match; valid no-match stays empty',async()=>{
 await assert.rejects(()=>api.fetchSharpSnapshot('secret',async()=>response([],{body:{meta:{store:{reason:'warming'}}}})),/not ready/);
 const data=await api.fetchSharpSnapshot('secret',async()=>response([],{body:{meta:{store:{reason:'no_match'}}}}));
 assert.equal(data.rows.length,0);assert.equal(api.normalizeSharpSnapshot(data).markets.length,0);
});
test('database unavailable means zero live HTTP calls and an explicit failed provider',async()=>{
 const value=await api.fetchSharpApiBoard(api.sharpApiProvider({SHARP_API_ENABLED:'true',SHARP_API_KEY:'secret'}));
 assert.equal(value.ok,false);assert.match(value.error,/no upstream request made/);assert.equal(JSON.stringify(value).includes('secret'),false);
});
test('all integration switches retain existing providers and release gates',()=>{
 const config=readFileSync(new URL('../src/lib/providers/config.ts',import.meta.url),'utf8');
 const http=readFileSync(new URL('../src/lib/providers/http.ts',import.meta.url),'utf8');
 assert.match(config,/sharpApiProvider\(\)/);assert.match(config,/theOddsApiProvider\(\)/);assert.match(config,/sportsGameOddsProvider\(\)/);
 assert.match(http,/sharp-api:\/\/pregame-main/);assert.match(http,/fetchSharpApiBoard/);
});

test('generic normalization preserves delay, identity, eligibility and warnings',()=>{
 const normalizer=loadProvider('normalizeOdds',{'../math':{impliedProbability:n=>n<0?-n/(-n+100):100/(n+100)}});
 const source=api.normalizeSharpSnapshot(snap([quote(),quote('away')]),now);
 const data=normalizer.normalizeOddsPayload(source);
 assert.equal(data.markets.length,2);assert.equal(data.markets[0].liveEligible,false);
 assert.equal(data.markets[0].sourceDelaySeconds,60);assert.equal(data.markets[0].sourceEventId,'sharp-api:draftkings:event-1');
 assert.equal(data.markets[0].sourceTimestamp,quote().timestamp);assert.ok(data.markets[0].sourceAgeMin>=1);
 assert.match(data.warnings[0],/Not suitable for live/);
});
