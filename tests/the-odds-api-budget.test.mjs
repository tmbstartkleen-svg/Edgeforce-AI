import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';

const compile=path=>ts.transpileModule(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const policyExports={};
vm.runInNewContext(compile('src/lib/providers/oddsRefreshPolicy.ts'),{exports:policyExports});
const {estimateOddsRequestCost,adaptiveOddsPolicy}=policyExports;
const adapter=compile('src/lib/providers/theOddsApi.ts');
const initial=Date.parse('2026-11-25T00:00:00Z');
const catalog=[{key:'basketball_nba',active:true},{key:'americanfootball_nfl',active:true},
 {key:'icehockey_nhl',active:true},{key:'soccer_epl',active:true}];
const event=(sport='basketball_nba')=>({id:sport+'-event',sport_key:sport,commence_time:new Date(initial+3600000).toISOString(),
 bookmakers:[{key:'draftkings',last_update:new Date(initial-60000).toISOString(),markets:[]} ]});
const response=(body,remaining,status=200,extra={})=>Response.json(body,{status,headers:{
 ...(remaining===undefined?{}:{'x-requests-remaining':String(remaining)}),...extra
}});
const config={id:'the-odds-api',apiKey:'fixture-key-a',timeoutMs:10000,maxAgeMin:20};

function runtime(fetcher,overrides={}){
 const env={THE_ODDS_API_EXPANSION_SPORTS:'0',THE_ODDS_API_CREDIT_RESERVE:'25',...overrides};
 const clock={now:initial},calls=[];
 class Clock extends Date{
  constructor(...args){super(...(args.length?args:[clock.now]));}
  static now(){return clock.now;}
 }
 const exports={};
 vm.runInNewContext(adapter,{exports,require:name=>{
  if(name==='node:crypto')return crypto;
  if(name==='./oddsRefreshPolicy')return policyExports;
  throw new Error('Unexpected dependency '+name);
 },process:{env},URL,Date:Clock,AbortController,TextDecoder,setTimeout,clearTimeout,
 fetch:async(url,init)=>{const call={url:new URL(url),init};calls.push(call);return fetcher(call,calls.length,clock);}});
 return {fetch:exports.fetchTheOddsApiBoard,env,calls,clock};
}

test('request cost counts unique markets and bookmaker groups with precedence over regions',()=>{
 assert.equal(estimateOddsRequestCost({markets:'h2h,spreads,totals',regions:'us,uk'}),6);
 assert.equal(estimateOddsRequestCost({markets:'h2h,h2h',regions:'us,us'}),1);
 const books=n=>Array.from({length:n},(_,i)=>'book'+i).join(',');
 assert.equal(estimateOddsRequestCost({markets:'h2h,spreads,totals',bookmakers:books(10),regions:'us,uk,eu'}),3);
 assert.equal(estimateOddsRequestCost({markets:'h2h,spreads,totals',bookmakers:books(11),regions:'us'}),6);
 assert.equal(estimateOddsRequestCost({markets:'h2h',bookmakers:books(21)}),3);
 const policy=adaptiveOddsPolicy({remaining:undefined,reserve:25,configuredMaxSports:8,alreadyCovered:new Set(),activeSports:catalog});
 assert.equal(policy.selectedSports.length,0);
});

test('free quota preflight protects the reserve before any paid bootstrap and caches the blocked result',async()=>{
 const r=runtime(()=>response(catalog,2,200,{'x-requests-used':'498'}));
 const result=await r.fetch(config);
 assert.equal(result.ok,false);assert.match(result.error,/CREDIT_RESERVE/);
 assert.equal(result.quota.remaining,2);assert.equal(result.quota.used,498);
 assert.equal(result.attempts.length,0);assert.equal(r.calls.length,1);
 assert.equal(result.diagnostics.failureKind,'CREDIT_RESERVE');
 assert.equal(result.diagnostics.requests.length,2);
 assert.equal(result.diagnostics.requests[0].stage,'PREFLIGHT');
 assert.equal(result.diagnostics.requests[0].httpStatus,200);
 assert.equal(result.diagnostics.requests[1].stage,'BOOTSTRAP');
 assert.equal(result.diagnostics.requests[1].attempted,false);
 assert.equal(result.diagnostics.requests[1].httpStatus,undefined);
 assert.equal(r.calls[0].url.pathname,'/v4/sports/');
 assert.equal(r.calls[0].url.searchParams.has('apiKey'),false);
 assert.equal(r.calls[0].init.headers['x-api-key'],config.apiKey);
 await r.fetch(config);assert.equal(r.calls.length,1);
 assert.ok(result.retryAfterMs>=600000);
});

test('missing, malformed and unsafe quota headers stay unknown and prohibit paid requests',async()=>{
 for(const value of [undefined,'',' ','abc','-1','1.5','Infinity','9007199254740992']){
  const r=runtime(()=>response(catalog,value));
  const result=await r.fetch(config);
  assert.equal(result.ok,false,String(value));assert.equal(result.quota.remaining,undefined);
  assert.match(result.error,/QUOTA_UNVERIFIED/);assert.equal(r.calls.length,1);
 }
 const zero=runtime(()=>response(catalog,0));
 assert.equal((await zero.fetch(config)).quota.remaining,0);
});

test('bootstrap cost must fit above reserve including bookmaker groups and actual configured regions',async()=>{
 for(const [overrides,remaining,allowed] of [
  [{},28,true],[{},27,false],
  [{THE_ODDS_API_BOOKMAKERS:'',THE_ODDS_API_REGIONS:'us,uk'},30,false],
  [{THE_ODDS_API_BOOKMAKERS:Array.from({length:11},(_,i)=>'book'+i).join(',')},30,false],
  [{THE_ODDS_API_REGIONS:'us,uk,eu'},28,true]
 ]){
  const r=runtime(call=>response(call.url.pathname.endsWith('/sports/')?catalog:[event()],call.url.pathname.endsWith('/sports/')?remaining:25),overrides);
  const result=await r.fetch(config);
  assert.equal(result.ok,allowed,JSON.stringify(overrides));assert.equal(r.calls.length,allowed?2:1);
 }
});

test('fallback rechecks the latest remaining budget and never reuses missing or superseded quota evidence',async()=>{
 for(const [afterPrimary,allowed] of [[26,true],[25,false],[undefined,false]]){
  const r=runtime((call,index)=>index===1?response(catalog,28):index===2?
   response({message:'Invalid market combination'},afterPrimary,422):response([event()],25));
  const result=await r.fetch(config);
  assert.equal(result.ok,allowed,String(afterPrimary));assert.equal(r.calls.length,allowed?3:2);
  if(allowed){
   assert.equal(result.attempts[1].sportKey,'upcoming-us-h2h');
   assert.equal(result.attempts[1].estimatedCost,1);
   assert.equal(r.calls[2].url.searchParams.get('markets'),'h2h');
   assert.equal(r.calls[2].url.searchParams.has('bookmakers'),false);
  }else assert.match(result.error,/QUOTA_UNVERIFIED|CREDIT_RESERVE/);
 }
});

test('every expansion uses new response quota and stops before its full cost would consume the reserve',async()=>{
 const r=runtime((call,index)=>index===1?response(catalog,120):index===2?response([event()],117):
  response([event('americanfootball_nfl')],27),{
   THE_ODDS_API_EXPANSION_SPORTS:'3',THE_ODDS_API_EXPANSION_MARKETS:'h2h,spreads,totals'
  });
 const result=await r.fetch(config);
 assert.equal(result.ok,true);assert.equal(r.calls.length,3);
 assert.equal(result.attempts[1].estimatedCost,3);
 assert.equal(result.quota.remaining,27);
 assert.ok(result.warnings.some(x=>x.includes('CREDIT_RESERVE')));
 assert.equal(result.diagnostics.requests.at(-1).stage,'EXPANSION');
 assert.equal(result.diagnostics.requests.at(-1).attempted,false);
 assert.equal(result.diagnostics.failureKind,'CREDIT_RESERVE');
});

test('missing quota after a paid success prevents expansion while preserving the returned data',async()=>{
 const r=runtime((call,index)=>index===1?response(catalog,500):response([event()],undefined),{THE_ODDS_API_EXPANSION_SPORTS:'8'});
 const result=await r.fetch(config);
 assert.equal(result.ok,true);assert.equal(r.calls.length,2);assert.equal(result.quota.remaining,undefined);
 assert.equal(result.data.length,1);assert.ok(result.warnings.some(x=>x.includes('unverified')));
 assert.equal(result.diagnostics.quotaEvidence,'UNAVAILABLE');
 assert.equal(result.diagnostics.failureKind,'QUOTA_UNVERIFIED');
});

test('identical concurrent calls coalesce and key or request configuration changes cannot share cached data',async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 const r=runtime(async(call,index)=>{
  if(index===1)await gate;
  return response(call.url.pathname.endsWith('/sports/')?catalog:[event()],call.url.pathname.endsWith('/sports/')?28:25);
 });
 const first=r.fetch(config),second=r.fetch(config),third=r.fetch(config);
 await Promise.resolve();assert.equal(r.calls.length,1);release();
 assert.ok((await Promise.all([first,second,third])).every(x=>x.ok));assert.equal(r.calls.length,2);
 await r.fetch({...config,apiKey:'fixture-key-b'});assert.equal(r.calls.length,4);
 r.env.THE_ODDS_API_MARKETS='h2h';
 await r.fetch(config);assert.equal(r.calls.length,6);
 assert.equal(r.calls[5].url.searchParams.get('markets'),'h2h');
});

test('different configurations on one account serialize free preflight and paid work within the isolate',async()=>{
 let remaining=28;
 const r=runtime(call=>{
  if(call.url.pathname.endsWith('/sports/'))return response(catalog,remaining);
  remaining-=3;return response([event()],remaining);
 });
 const first=r.fetch(config);
 r.env.THE_ODDS_API_REGIONS='us,uk';
 const second=r.fetch(config);
 const results=await Promise.all([first,second]);
 assert.equal(results.filter(x=>x.ok).length,1);assert.equal(remaining,25);
 assert.equal(r.calls.filter(x=>x.url.pathname.endsWith('/odds')).length,1);
 assert.equal(r.calls.filter(x=>x.url.pathname.endsWith('/sports/')).length,2);
});

test('cached responses become explicitly stale without changing source timestamps or accelerating paid refresh',async()=>{
 const r=runtime((call,index)=>response(index===1?catalog:[event()],index===1?28:25));
 const first=await r.fetch(config),stamp=first.data[0].bookmakers[0].last_update;
 r.clock.now+=21*60000;
 const cached=await r.fetch(config);
 assert.equal(cached.ok,false);assert.equal(cached.status,503);assert.match(cached.error,/CACHE_STALE/);
 assert.equal(cached.cacheAgeMs,21*60000);assert.equal(cached.data[0].bookmakers[0].last_update,stamp);
 assert.equal(r.calls.length,2);assert.ok(cached.retryAfterMs>0);
 assert.equal(first.diagnostics.cacheHit,false);assert.equal(first.diagnostics.quotaEvidence,'CURRENT_RESPONSE');
 assert.equal(cached.diagnostics.cacheHit,true);assert.equal(cached.diagnostics.quotaEvidence,'CACHED_RESPONSE');
 assert.equal(cached.diagnostics.failureKind,'CACHE_STALE');
 assert.equal(cached.diagnostics.quotaObservedAt,first.diagnostics.quotaObservedAt);
 assert.equal(cached.diagnostics.requests[0].observedAt,first.diagnostics.requests[0].observedAt);
});

test('batch deadline prevents late bootstrap or expansion and 429 never triggers an immediate retry',async()=>{
 const preflight=runtime((call,index,clock)=>{clock.now+=6500;return response(catalog,100);});
 const blocked=await preflight.fetch(config);
 assert.equal(blocked.ok,false);assert.equal(preflight.calls.length,1);assert.match(blocked.error,/deadline/);
 assert.equal(blocked.diagnostics.requests.at(-1).failureKind,'DEADLINE');
 assert.equal(blocked.diagnostics.requests.at(-1).attempted,false);
 assert.equal(blocked.diagnostics.requests.at(-1).responseReceived,false);
 assert.equal(blocked.diagnostics.requests.at(-1).httpStatus,undefined);
 const expansion=runtime((call,index,clock)=>{
  if(index===2)clock.now+=6000;
  return response(index===1?catalog:[event()],index===1?100:97);
 },{THE_ODDS_API_EXPANSION_SPORTS:'8'});
 assert.equal((await expansion.fetch(config)).ok,true);assert.equal(expansion.calls.length,2);
 const limited=runtime((call,index)=>index===1?response(catalog,100):response({message:'Rate limited'},100,429));
 const result=await limited.fetch(config);
 assert.equal(result.status,429);assert.equal(result.retryAfterMs,300000);assert.equal(limited.calls.length,2);
});

test('failed authentication, malformed catalogs, and malformed odds arrays do not start extra paid calls or leak credentials',async()=>{
 const denied=runtime(()=>response({message:'Invalid key '+config.apiKey,error_code:'INVALID_KEY'},undefined,401));
 const result=await denied.fetch(config);
 assert.equal(result.ok,false);assert.equal(denied.calls.length,1);
 assert.ok(!JSON.stringify(result).includes(config.apiKey));
 assert.match(result.error,/INVALID_KEY/);
 const badCatalog=runtime(()=>response({error:'Invalid shape'},100));
 assert.equal((await badCatalog.fetch(config)).status,502);assert.equal(badCatalog.calls.length,1);
 const badOdds=runtime((call,index)=>response(index===1?catalog:{unexpected:true},100));
 assert.equal((await badOdds.fetch(config)).status,502);assert.equal(badOdds.calls.length,2);
});

test('network failures have redacted transport evidence and do not invent an HTTP response or quota balance',async()=>{
 const sensitive='https://upstream.invalid/?apiKey='+config.apiKey;
 const r=runtime(()=>{throw Object.assign(new TypeError('request failed '+sensitive),{cause:{code:'ENOTFOUND',message:sensitive}});});
 const result=await r.fetch(config),d=result.diagnostics,request=d.requests[0];
 assert.equal(result.ok,false);assert.equal(r.calls.length,1);assert.equal(result.attempts.length,0);
 assert.equal(d.failureKind,'NETWORK');assert.equal(d.quotaEvidence,'UNAVAILABLE');
 assert.equal(d.quotaObservedAt,undefined);assert.equal(result.quota.remaining,undefined);
 assert.equal(request.stage,'PREFLIGHT');assert.equal(request.endpoint,'SPORTS_CATALOG');
 assert.equal(request.attempted,true);assert.equal(request.responseReceived,false);
 assert.equal(request.httpStatus,undefined);assert.equal(request.observedAt,undefined);
 assert.equal(request.failurePhase,'REQUEST');assert.equal(request.transportCode,'ENOTFOUND');
 assert.equal(request.transportErrorName,'TypeError');assert.equal(request.responseBytes,0);
 assert.ok(!JSON.stringify(result).includes(config.apiKey));assert.ok(!JSON.stringify(result).includes('upstream.invalid'));
 r.clock.now+=2000;
 const cached=await r.fetch(config);
 assert.equal(r.calls.length,1);assert.equal(cached.diagnostics.cacheHit,true);
 assert.equal(cached.diagnostics.cacheAgeMs,2000);assert.equal(cached.diagnostics.quotaEvidence,'UNAVAILABLE');
});

test('an opaque status-zero response is not recorded as an actual HTTP response',async()=>{
 const r=runtime(()=>Response.error());
 const result=await r.fetch(config),request=result.diagnostics.requests[0];
 assert.equal(result.diagnostics.failureKind,'NETWORK');assert.equal(result.diagnostics.quotaEvidence,'UNAVAILABLE');
 assert.equal(request.responseReceived,false);assert.equal(request.httpStatus,undefined);assert.equal(request.observedAt,undefined);
 assert.equal(result.quota.remaining,undefined);assert.equal(r.calls.length,1);
});

test('HTTP auth, rate limit, quota exhaustion and server errors retain distinct current response evidence',async()=>{
 for(const [status,code,kind,remaining] of [
  [401,'INVALID_KEY','AUTH',undefined],[403,'DEACTIVATED_KEY','AUTH',undefined],
  [401,'OUT_OF_USAGE_CREDITS','QUOTA_EXHAUSTED',0],[429,'EXCEEDED_FREQ_LIMIT','RATE_LIMITED',10],
  [503,undefined,'HTTP',50],[422,'INVALID_MARKET','HTTP',50]
 ]){
  const r=runtime(()=>response({error_code:code,message:'Private diagnostic '+config.apiKey},remaining,status));
  const result=await r.fetch(config),request=result.diagnostics.requests[0];
  assert.equal(result.status,status);assert.equal(result.diagnostics.failureKind,kind,String(status)+' '+code);
  assert.equal(request.httpStatus,status);assert.equal(request.responseReceived,true);
  assert.equal(request.providerErrorCode,code);assert.equal(request.quota.remaining,remaining);
  assert.equal(result.diagnostics.quotaEvidence,remaining===undefined?'UNAVAILABLE':'CURRENT_RESPONSE');
  assert.equal(request.observedAt,new Date(initial).toISOString());assert.ok(request.responseBytes>0);
  assert.equal(r.calls.length,1);assert.equal(result.attempts.length,0);
  assert.ok(!JSON.stringify(result).includes(config.apiKey));
 }
 const unknown=runtime(()=>response({error_code:'Unknown '+config.apiKey,message:'https://private.invalid'},undefined,500));
 const result=await unknown.fetch(config);
 assert.equal(result.diagnostics.requests[0].providerErrorCode,undefined);
 assert.ok(!JSON.stringify(result).includes(config.apiKey));assert.ok(!JSON.stringify(result).includes('private.invalid'));
});

test('invalid JSON retains actual HTTP status and quota headers without starting paid odds work',async()=>{
 for(const [status,kind] of [[200,'INVALID_JSON'],[503,'HTTP']]){
  const r=runtime(()=>new Response('not JSON '+config.apiKey,{status,headers:{
   'x-requests-remaining':'98','x-requests-used':'402','x-requests-last':'0'
  }}));
  const result=await r.fetch(config),request=result.diagnostics.requests[0];
  assert.equal(result.status,status===200?502:503);assert.equal(result.diagnostics.failureKind,kind);
  assert.equal(request.httpStatus,status);assert.equal(request.responseReceived,true);
  assert.equal(request.bodyFailureKind,'INVALID_JSON');assert.equal(request.failurePhase,'RESPONSE_BODY');
  assert.equal(result.quota.remaining,98);assert.equal(result.quota.used,402);assert.equal(result.quota.last,0);
  assert.equal(result.diagnostics.quotaEvidence,'CURRENT_RESPONSE');assert.equal(r.calls.length,1);
  assert.ok(!JSON.stringify(result).includes(config.apiKey));
 }
});

test('body read failures preserve headers and distinguish body transport from missing HTTP responses',async()=>{
 const privateError=Object.assign(new TypeError('socket failed at https://private.invalid/'+config.apiKey),{code:'UND_ERR_SOCKET'});
 const r=runtime(()=>new Response(new ReadableStream({start(controller){controller.error(privateError);}}),{
  status:200,headers:{'x-requests-remaining':'74'}
 }));
 const result=await r.fetch(config),request=result.diagnostics.requests[0];
 assert.equal(result.diagnostics.failureKind,'BODY_READ_FAILED');assert.equal(request.bodyFailureKind,'BODY_READ_FAILED');
 assert.equal(request.failurePhase,'RESPONSE_BODY');assert.equal(request.httpStatus,200);
 assert.equal(request.responseReceived,true);assert.equal(request.transportCode,'UND_ERR_SOCKET');
 assert.equal(request.transportErrorName,'TypeError');assert.equal(result.quota.remaining,74);
 assert.equal(r.calls.length,1);assert.ok(!JSON.stringify(result).includes(config.apiKey));
 assert.ok(!JSON.stringify(result).includes('private.invalid'));
});

test('request and body timeouts are bounded without retries and retain their distinct observed response phases',async()=>{
 for(const phase of ['REQUEST','RESPONSE_BODY']){
  const r=runtime(()=>phase==='REQUEST'?new Promise(()=>{}):new Response(new ReadableStream({start(){}}),{
   status:200,headers:{'x-requests-remaining':'55'}
  }),{THE_ODDS_API_TIMEOUT_MS:'1000',THE_ODDS_API_BATCH_BUDGET_MS:'1000'});
  const result=await r.fetch(config),request=result.diagnostics.requests[0];
  assert.equal(result.status,504);assert.equal(result.diagnostics.failureKind,'TIMEOUT');
  assert.equal(request.failurePhase,phase);assert.equal(request.responseReceived,phase==='RESPONSE_BODY');
  assert.equal(request.httpStatus,phase==='RESPONSE_BODY'?200:undefined);
  assert.equal(result.quota.remaining,phase==='RESPONSE_BODY'?55:undefined);
  assert.equal(r.calls.length,1);assert.equal(r.calls[0].init.signal.aborted,true);
 }
 const r=runtime(()=>{throw Object.assign(new TypeError('fetch failed '+config.apiKey),{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}});});
 const result=await r.fetch(config);
 assert.equal(result.diagnostics.failureKind,'TIMEOUT');
 assert.equal(result.diagnostics.requests[0].transportCode,'UND_ERR_CONNECT_TIMEOUT');
 assert.ok(!JSON.stringify(result).includes(config.apiKey));
});

test('redirects are reported without following or exposing the destination or authentication header',async()=>{
 const r=runtime(()=>new Response(null,{status:302,headers:{location:'https://private.invalid/?apiKey='+config.apiKey}}));
 const result=await r.fetch(config),request=result.diagnostics.requests[0];
 assert.equal(result.status,302);assert.equal(request.httpStatus,302);
 assert.equal(result.diagnostics.failureKind,'REDIRECT_BLOCKED');assert.equal(request.responseReceived,true);
 assert.equal(r.calls.length,1);assert.equal(r.calls[0].init.redirect,'manual');
 assert.ok(!JSON.stringify(result).includes(config.apiKey));assert.ok(!JSON.stringify(result).includes('private.invalid'));
});

test('oversized response bodies are canceled within a fixed byte budget and preserve known HTTP evidence',async()=>{
 for(const [status,limit,kind] of [[200,4*1024*1024,'BODY_TOO_LARGE'],[503,16*1024,'HTTP']]){
  let canceled=0;
  const bytes=new TextEncoder().encode(' '.repeat(limit)+config.apiKey);
  const r=runtime(()=>new Response(new ReadableStream({
   start(controller){controller.enqueue(bytes);},cancel(){canceled++;}
  }),{status,headers:{'x-requests-remaining':'88'}}));
  const result=await r.fetch(config),request=result.diagnostics.requests[0];
  assert.equal(result.diagnostics.failureKind,kind);assert.equal(request.bodyFailureKind,'BODY_TOO_LARGE');
  assert.equal(request.httpStatus,status);assert.equal(result.quota.remaining,88);
  assert.equal(request.responseBytes,bytes.length);assert.equal(canceled,1);assert.equal(r.calls.length,1);
  assert.ok(!JSON.stringify(result).includes(config.apiKey));
 }
});

test('a paid request transport failure invalidates the earlier preflight budget without extra paid calls',async()=>{
 const r=runtime((call,index)=>{
  if(index===1)return response(catalog,100);
  throw Object.assign(new TypeError('fetch failed '+config.apiKey),{cause:{code:'ECONNRESET'}});
 },{THE_ODDS_API_EXPANSION_SPORTS:'8'});
 const result=await r.fetch(config),requests=result.diagnostics.requests;
 assert.equal(result.ok,false);assert.equal(r.calls.length,2);assert.equal(result.attempts.length,1);
 assert.equal(result.diagnostics.failureKind,'NETWORK');assert.equal(result.diagnostics.quotaEvidence,'UNAVAILABLE');
 assert.equal(result.quota.remaining,undefined);assert.equal(result.diagnostics.quotaObservedAt,undefined);
 assert.equal(requests[0].quota.remaining,100);assert.equal(requests[0].httpStatus,200);
 assert.equal(requests[1].stage,'BOOTSTRAP');assert.equal(requests[1].httpStatus,undefined);
 assert.equal(requests[1].responseReceived,false);assert.equal(requests[1].transportCode,'ECONNRESET');
 assert.ok(!JSON.stringify(result).includes(config.apiKey));
});

test('invalid local configuration produces a diagnostic without dispatching or exposing configured values',async()=>{
 for(const [overrides,nextConfig] of [
  [{THE_ODDS_API_BASE_URL:'not-a-url-'+config.apiKey},config],
  [{THE_ODDS_API_BASE_URL:'ftp://private.invalid'},config],
  [{THE_ODDS_API_BASE_URL:'https://'+config.apiKey+'@private.invalid'},config],
  [{},{...config,apiKey:''}]
 ]){
  const r=runtime(()=>{throw new Error('Network should not run');},overrides);
  const result=await r.fetch(nextConfig);
  assert.equal(result.diagnostics.failureKind,'CONFIGURATION');assert.equal(result.diagnostics.requests.length,0);
  assert.equal(result.diagnostics.quotaEvidence,'UNAVAILABLE');assert.equal(r.calls.length,0);
  assert.ok(!JSON.stringify(result).includes(config.apiKey));assert.ok(!JSON.stringify(result).includes('private.invalid'));
 }
});
