import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {loadProvider} from './helpers/load-provider.mjs';

const registrySource=readFileSync(new URL('../src/lib/sportRegistry.ts',import.meta.url),'utf8');
const registry=loadProvider('../sportRegistry');
const sourceRaw=readFileSync(new URL('../src/lib/liveScoreMesh.ts',import.meta.url),'utf8');
const runtime=loadProvider('../liveScoreMesh',{
 './providers/sportScore':{fetchSportScoreBackup:async()=>({enabled:false,games:[],warnings:[],attribution:{required:true,label:'Powered by SportScore',url:'https://sportscore.com/'}})},
 './providers/communityScoreBackups':{fetchCommunityScoreBackups:async()=>({games:[],warnings:[],sourceState:[]})}
});

const acquisitionFixture=JSON.parse(readFileSync(new URL('./fixtures/espn-scoreboard-modern-odds.json',import.meta.url),'utf8'));
function acquisitionRuntime(ids,overrides={}){
 return loadProvider('../liveScoreMesh',{
  './sportRegistry':{...registry,ESPN_SCOREBOARD_FEEDS:registry.ESPN_SCOREBOARD_FEEDS.filter(feed=>ids.includes(feed.id))},
  './providers/sportScore':{fetchSportScoreBackup:async()=>({enabled:false,games:[]})},
  './providers/communityScoreBackups':{fetchCommunityScoreBackups:async()=>({games:[],warnings:[],sourceState:[]})},
  ...overrides
 });
}
function futureScoreboard(now=Date.now()){
 const event=structuredClone(acquisitionFixture.events[0]);
 event.date=new Date(now+3600000).toISOString();event.competitions[0].date=event.date;
 return {events:[event]};
}
function response(payload){return new Response(JSON.stringify(payload),{status:200})}
function nativeResponse(url){
 if(url.includes('/v1/score/now'))return response({games:[]});
 if(url.includes('statsapi.mlb.com'))return response({dates:[]});
 return null;
}

test('ESPN site scoreboard parser retains live clock and teams',()=>{
 const rows=runtime.parseEspnLiveGames({events:[{
  id:'game-1',date:'2026-10-06T23:00:00Z',
  status:{displayClock:'04:32',period:4,type:{state:'in',detail:'4th Quarter'}},
  competitions:[{competitors:[
   {homeAway:'home',score:'101',team:{displayName:'Home Team'}},
   {homeAway:'away',score:'99',team:{displayName:'Away Team'}}
  ]}]
 }]},'NBA');
 assert.equal(rows.length,1);
 assert.equal(rows[0].status,'LIVE');
 assert.equal(rows[0].clock,'04:32');
 assert.equal(rows[0].home.score,101);
 assert.equal(rows[0].away.score,99);
});

test('ESPN CDN game package upgrades a discovered live game without changing identity',()=>{
 const base={
  id:'401000001',sport:'NBA',league:'NBA',source:'espn-public',status:'LIVE',detail:'3rd Quarter',
  clock:'02:00',period:'3',startTime:'2026-10-06T23:00:00Z',
  home:{name:'Home Team',score:80},away:{name:'Away Team',score:79},observedAt:'2026-10-06T23:30:00Z'
 };
 const updated=runtime.parseEspnCdnGame({gamepackageJSON:{header:{competitions:[{
  competitors:[{homeAway:'home',score:'84'},{homeAway:'away',score:'81'}],
  status:{displayClock:'01:12',period:3,type:{state:'in',detail:'3rd Quarter'}}
 }]}}},base);
 assert.ok(updated);
 assert.equal(updated.id,base.id);
 assert.equal(updated.source,'espn-cdn');
 assert.equal(updated.clock,'01:12');
 assert.equal(updated.home.name,'Home Team');
 assert.equal(updated.home.score,84);
 assert.equal(updated.away.score,81);
});

test('CDN parser fails closed when competition sides are missing',()=>{
 const base={id:'x',sport:'NFL',league:'NFL',source:'espn-public',status:'LIVE',detail:'live',home:{name:'A',score:1},away:{name:'B',score:2},observedAt:new Date().toISOString()};
 assert.equal(runtime.parseEspnCdnGame({gamepackageJSON:{header:{competitions:[{competitors:[]}]}}},base),null);
});

test('mesh source contains sub-second fast path, adaptive freshness governor, and broad backup coverage',()=>{
 assert.match(sourceRaw,/LIVE_SCORE_ESPN_CDN_LIVE_CACHE_MS\|\|750/);
 assert.match(sourceRaw,/recommendedUiRefreshMs/);
 assert.match(sourceRaw,/g\.source==='espn-public'\|\|g\.source==='espn-cdn'/);
 assert.match(sourceRaw,/reconcileLiveGames\(specialized,espnGames/);
 for(const marker of ['womens-college-basketball','college-baseball','uefa.champions','australian-football','rugby-league'])assert.ok(registrySource.includes(marker),marker);
 assert.ok(sourceRaw.includes("source:'espn-cdn'"));
});


test('master sport registry includes NCAA depth and global external families',()=>{
 const summary=registry.sportCoverageSummary();
 assert.ok(summary.ncaa>=15,JSON.stringify(summary));
 assert.ok(registry.SPORT_FAMILIES.includes('table-tennis'));
 assert.ok(registry.SPORT_FAMILIES.includes('tennis'));
 assert.ok(registry.SPORT_FAMILIES.includes('mma'));
 assert.ok(registry.GLOBAL_SPORT_REGISTRY.some(x=>x.id==='ncaa-softball'));
 assert.ok(registry.GLOBAL_SPORT_REGISTRY.some(x=>x.id==='ncaa-m-water-polo'));
 assert.ok(registry.GLOBAL_SPORT_REGISTRY.some(x=>x.id==='ncaa-w-volleyball'));
 assert.equal(registry.GLOBAL_SPORT_REGISTRY.find(x=>x.id==='table-tennis')?.scoreProvider,'EXTERNAL');
});


test('freshness governor prefers richer fast-path rows and adapts UI cadence',()=>{
 const observedAt='2026-10-07T12:00:00.000Z';
 const base={
  id:'401000001',sport:'NBA',league:'NBA',status:'LIVE',detail:'3rd Quarter',
  period:'3',startTime:'2026-10-07T11:30:00Z',
  home:{name:'Home Team',score:80},away:{name:'Away Team',score:79},observedAt
 };
 const publicRow={...base,source:'espn-public',clock:undefined};
 const cdnRow={...base,source:'espn-cdn',clock:'01:12',home:{...base.home,score:84},away:{...base.away,score:81}};
 const communityRow={...base,source:'thesportsdb',clock:'01:40',home:{...base.home,score:82},away:{...base.away,score:80}};
 const reconciled=runtime.reconcileLiveGames([publicRow],[communityRow],[cdnRow]);
 assert.equal(reconciled.length,1);
 assert.equal(reconciled[0].source,'espn-cdn');
 assert.equal(reconciled[0].clock,'01:12');
 const fresh=runtime.evaluateLiveScoreFreshness([cdnRow],Date.parse(observedAt)+1000);
 assert.equal(fresh.state,'FAST');
 assert.equal(fresh.recommendedUiRefreshMs,750);
 const stale=runtime.evaluateLiveScoreFreshness([cdnRow],Date.parse(observedAt)+20000);
 assert.equal(stale.state,'STALE');
 assert.ok(stale.recommendedUiRefreshMs>=1500);
});


test('V148 consensus distinguishes corroboration, lag, and active contradictions',()=>{
 const now=Date.now();
 const iso=(delta)=>new Date(now+delta).toISOString();
 const base={
  id:'game-consensus',sport:'NBA',league:'NBA',status:'LIVE',detail:'4th Quarter',clock:'02:10',period:'4',
  startTime:iso(-3600000),
  home:{name:'Home Team',score:84},away:{name:'Away Team',score:81}
 };
 const cdn={...base,source:'espn-cdn',observedAt:iso(0)};
 const publicSame={...base,source:'espn-public',clock:'02:12',observedAt:iso(-1000)};
 const lagging={...base,source:'thesportsdb',home:{...base.home,score:82},away:{...base.away,score:80},observedAt:iso(-6000)};
 const corroborated=runtime.reconcileLiveGames([lagging],[publicSame],[cdn]);
 assert.equal(corroborated.length,1);
 assert.equal(corroborated[0].source,'espn-cdn');
 assert.equal(corroborated[0].consensus.confidence,'HIGH');
 assert.equal(corroborated[0].consensus.agreeingSources,2);
 assert.equal(corroborated[0].consensus.activeConflict,false);
 assert.deepEqual(corroborated[0].consensus.laggingSources,['thesportsdb']);

 const activeConflict={...base,source:'api-sports',home:{...base.home,score:83},observedAt:iso(-500)};
 const conflicted=runtime.reconcileLiveGames([publicSame],[activeConflict],[cdn]);
 assert.equal(conflicted[0].consensus.activeConflict,true);
 assert.equal(conflicted[0].consensus.scoreConflict,true);
 assert.equal(conflicted[0].consensus.confidence,'MEDIUM');
 const summary=runtime.summarizeLiveScoreConsensus(conflicted);
 assert.equal(summary.liveGames,1);
 assert.equal(summary.activeConflicts,1);
 assert.equal(summary.medium,1);
 assert.equal(summary.conflictRate,1);
});

test('V148 consensus marks one-source live rows explicitly',()=>{
 const now=Date.now();
 const row={
  id:'solo',sport:'NHL',league:'NHL',source:'nhl-web',status:'LIVE',detail:'2nd',clock:'08:00',period:'2',
  startTime:new Date(now-3600000).toISOString(),home:{name:'Home',score:2},away:{name:'Away',score:1},observedAt:new Date(now).toISOString()
 };
 const reconciled=runtime.reconcileLiveGames([row]);
 assert.equal(reconciled[0].consensus.confidence,'SINGLE_SOURCE');
 assert.equal(reconciled[0].consensus.sourceCount,1);
 assert.equal(runtime.summarizeLiveScoreConsensus(reconciled).singleSource,1);
});

test('V157 duplicated provider observations cannot create false independent corroboration',()=>{
 const now='2026-10-08T12:00:00.000Z';
 const base={id:'dup',sport:'NBA',league:'NBA',status:'LIVE',detail:'Q4',clock:'01:00',period:'4',
  startTime:'2026-10-08T11:00:00.000Z',home:{name:'Home',score:90},away:{name:'Away',score:88}};
 const first={...base,source:'espn-cdn',observedAt:now};
 const second={...base,source:'espn-cdn',observedAt:now};
 const result=runtime.liveScoreConsensus([first,second],first,Date.parse(now));
 assert.equal(result.sourceCount,1);
 assert.equal(result.observationCount,2);
 assert.equal(result.agreeingSources,1);
 assert.equal(result.confidence,'SINGLE_SOURCE');
});

test('V157 only contemporaneous independent providers qualify for consensus',()=>{
 const now='2026-10-08T12:00:00.000Z';
 const base={id:'stale-peer',sport:'NHL',league:'NHL',status:'LIVE',detail:'P3',
  startTime:'2026-10-08T11:00:00.000Z',home:{name:'Home',score:3},away:{name:'Away',score:2}};
 const selected={...base,source:'nhl-web',observedAt:now};
 const old={...base,source:'thesportsdb',observedAt:'2026-10-08T11:59:30.000Z'};
 const result=runtime.liveScoreConsensus([selected,old],selected,Date.parse(now));
 assert.equal(result.sourceCount,1);
 assert.equal(result.confidence,'SINGLE_SOURCE');
});


test('V163 distinct leagues never share a live-score identity',()=>{
 const now=new Date().toISOString();
 const base={id:'g1',sport:'soccer',league:'MLS',source:'espn-public',status:'LIVE',detail:'live',startTime:now,home:{name:'United',score:1},away:{name:'City',score:0},observedAt:now};
 assert.notEqual(runtime.liveGameIdentity(base),runtime.liveGameIdentity({...base,league:'EPL'}));
 assert.equal(runtime.reconcileLiveGames([base],[{...base,league:'EPL'}]).length,2);
});

test('V163 future-skewed live observations cannot earn FAST freshness or corroboration',()=>{
 const now=Date.now();
 const future=new Date(now+600000).toISOString();
 const base={id:'future',sport:'NBA',league:'NBA',status:'LIVE',detail:'Q4',clock:'01:00',period:'4',startTime:new Date(now-3600000).toISOString(),home:{name:'Home',score:90},away:{name:'Away',score:88},observedAt:future};
 const selected={...base,source:'espn-cdn'};
 const other={...base,source:'espn-public'};
 assert.equal(runtime.evaluateLiveScoreFreshness([selected],now).state,'STALE');
 assert.equal(runtime.liveScoreConsensus([selected,other],selected,now).confidence,'SINGLE_SOURCE');
 assert.ok(runtime.liveGameQuality({...selected,observedAt:new Date(now).toISOString()},now)>runtime.liveGameQuality(selected,now));
});


test('V164 missing and malformed scores remain unknown, not zero',()=>{
 const make=(homeScore,awayScore)=>runtime.parseEspnLiveGames({events:[{
  id:'score-integrity',date:'2026-10-08T20:00:00Z',status:{type:{state:'in',detail:'Q1'}},
  competitions:[{competitors:[
   {homeAway:'home',score:homeScore,team:{displayName:'Home'}},
   {homeAway:'away',score:awayScore,team:{displayName:'Away'}}
  ]}]
 }]},'NBA')[0];
 for(const invalid of [null,undefined,'','  ','-','N/A',false,{},-1]){
  const row=make(invalid,8);
  assert.equal(row.home.score,null,String(invalid));
  assert.equal(row.away.score,8);
 }
 assert.equal(make('0','12').home.score,0);
 assert.equal(make(0,0).away.score,0);
});


test('V165 games without kickoff times use source and provider id to avoid false matches',()=>{
 const observedAt=new Date().toISOString();
 const base={id:'101',source:'espn-public',sport:'NBA',league:'NBA',status:'LIVE',detail:'Q1',home:{name:'Home',score:8},away:{name:'Away',score:6},observedAt};
 assert.notEqual(runtime.liveGameIdentity(base),runtime.liveGameIdentity({...base,id:'102'}));
 assert.notEqual(runtime.liveGameIdentity(base),runtime.liveGameIdentity({...base,source:'thesportsdb'}));
 assert.equal(runtime.reconcileLiveGames([base],[{...base,id:'102'}]).length,2);
 assert.equal(runtime.liveGameIdentity({...base,startTime:'2026-10-08T12:00:00Z'}),runtime.liveGameIdentity({...base,source:'thesportsdb',startTime:'2026-10-08T12:00:00Z'}));
});


test('V166 malformed backup-provider scores cannot count toward freshness or consensus',()=>{
 const now=Date.now();
 const base={id:'bad-backup',sport:'NBA',league:'NBA',status:'LIVE',detail:'Q4',clock:'01:00',period:'4',startTime:new Date(now-3600000).toISOString(),home:{name:'Home',score:90},away:{name:'Away',score:88},observedAt:new Date(now).toISOString()};
 const good={...base,source:'espn-cdn'};
 const bad={...base,source:'thesportsdb',home:{...base.home,score:NaN}};
 assert.equal(runtime.evaluateLiveScoreFreshness([bad],now).scoreCoverage,0);
 assert.equal(runtime.liveScoreConsensus([good,bad],good,now).agreeingSources,1);
 assert.ok(runtime.liveGameQuality(good,now)>runtime.liveGameQuality({...good,home:{...good.home,score:NaN}},now));
 for(const invalid of [undefined,NaN,Infinity,-1,'90',false]){
  const item={...bad,away:{...bad.away,score:invalid}};
  assert.equal(runtime.evaluateLiveScoreFreshness([item],now).scoreCoverage,0);
 }
});

test('score acquisition coalesces callers and retains completed observations through a deadline and late failure',async t=>{
 const savedFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=savedFetch});
 const api=acquisitionRuntime(['nba','nfl']);
 const calls=[];let rejectLate;
 globalThis.fetch=async url=>{
  url=String(url);calls.push(url);
  const native=nativeResponse(url);if(native)return native;
  if(url.includes('/basketball/nba/scoreboard'))return response(futureScoreboard());
  if(url.includes('/football/nfl/scoreboard'))return new Promise((_,reject)=>{rejectLate=reject});
  throw new Error('Unexpected request '+url);
 };
 t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.now()});
 const started=Date.now(),first=api.fetchLiveScoreMesh({deadlineMs:80});
 const concurrent=api.fetchLiveScoreMesh({deadlineMs:80});
 assert.equal(first,concurrent,'one acquisition promise is shared by concurrent callers');
 await new Promise(resolve=>setImmediate(resolve));
 const progress=api.readCachedLiveScoreMesh();
 assert.equal(progress.observedOdds.referenceCount,6,'successful league is readable before another league finishes');
 const originalTime=progress.observedOdds.referenceQuotes[0].quoteObservedAt;
 t.mock.timers.tick(80);
 const result=await first;
 assert.equal(Date.now()-started,80,'deadline bounds even a transport that ignores abort');
 assert.equal(calls.length,4);
 assert.equal(result.observedOdds.referenceCount,6);
 assert.equal(result.collection.deadlineReached,true);
 assert.equal(result.collection.sources.find(source=>source.label==='NFL').status,'FAILED');
 rejectLate(new Error('late transport failure'));await new Promise(resolve=>setImmediate(resolve));
 const retained=api.readCachedLiveScoreMesh();
 assert.equal(retained.observedOdds.referenceCount,6);
 assert.equal(retained.observedOdds.referenceQuotes[0].quoteObservedAt,originalTime);
 assert.equal(retained.generatedAt,progress.generatedAt,'cache reads do not renew the evidence publication time');
});

test('slow optional backups cannot discard completed scoreboards and cached reads expire reference observations',async t=>{
 const savedFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=savedFetch});
 t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.now()});
 let calls=0;
 const backupStarted=Promise.withResolvers();
 const api=acquisitionRuntime(['nba'],{
  './providers/communityScoreBackups':{fetchCommunityScoreBackups:()=>{
   backupStarted.resolve();
   return new Promise(()=>{});
  }}
 });
 globalThis.fetch=async url=>{calls++;return nativeResponse(String(url))||response(futureScoreboard())};
 const pending=api.fetchLiveScoreMesh({deadlineMs:60});
 await backupStarted.promise;
 t.mock.timers.tick(60);
 const result=await pending;
 assert.equal(result.observedOdds.referenceCount,6);
 assert.equal(calls,3,'only existing primary requests are made');
 assert.ok(result.warnings.some(warning=>warning.includes('Community score backup')));
 const originalTime=result.observedOdds.referenceQuotes[0].quoteObservedAt;
 const future=Date.parse(originalTime)+300001;
 t.mock.timers.tick(future-Date.now());
 assert.equal(api.readCachedLiveScoreMesh().observedOdds.referenceCount,0);
 assert.equal(calls,3,'the cache reader does not initiate refreshes');
});

test('bounded primary queue gives deferred leagues the next opportunity without increasing concurrency',{timeout:5000},async t=>{
 const savedFetch=globalThis.fetch,SavedDate=Date,savedConcurrency=process.env.LIVE_SCORE_FETCH_CONCURRENCY;
 let clock=SavedDate.now();
 t.after(()=>{globalThis.fetch=savedFetch;globalThis.Date=SavedDate;if(savedConcurrency===undefined)delete process.env.LIVE_SCORE_FETCH_CONCURRENCY;else process.env.LIVE_SCORE_FETCH_CONCURRENCY=savedConcurrency});
 globalThis.Date=class extends SavedDate{
  constructor(...args){super(...(args.length?args:[clock]))}
  static now(){return clock}
 };
 process.env.LIVE_SCORE_FETCH_CONCURRENCY='2';
 const api=acquisitionRuntime(['nfl','nba','mlb','nhl','epl','wnba']);
 const calls=[];let active=0,peak=0;
 const createBatch=()=>({requests:[],waiters:[]});
 let batch=createBatch();
 const waitForStarts=count=>batch.requests.length>=count?Promise.resolve():new Promise(resolve=>batch.waiters.push({count,resolve}));
 globalThis.fetch=(url,options)=>{
  url=String(url);calls.push(url);active++;peak=Math.max(peak,active);
  const native=nativeResponse(url);
  const pending=native?Promise.resolve(native):new Promise((_,reject)=>{
   batch.requests.push({url,signal:options.signal,fail:()=>reject(new Error('controlled transport failure'))});
   options.signal.addEventListener('abort',()=>reject(new Error('mock aborted')),{once:true});
   for(const waiter of batch.waiters)if(batch.requests.length>=waiter.count)waiter.resolve();
  });
  return pending.finally(()=>active--);
 };
 const firstStarted=clock,firstPromise=api.fetchLiveScoreMesh({deadlineMs:1000});
 await waitForStarts(2);
 assert.equal(active,2);
 // A failed request just before the deadline can legitimately free a lane.
 // Total attempts therefore do not measure simultaneous concurrency.
 clock=firstStarted+999;
 batch.requests[0].fail();
 await waitForStarts(3);
 assert.equal(active,2);
 clock=firstStarted+1000;
 for(const request of batch.requests)request.fail();
 const first=await firstPromise;
 const firstLeagues=calls.filter(url=>url.includes('/scoreboard'));
 assert.equal(firstLeagues.length,3,'one replacement starts before the controlled deadline, none after');
 assert.ok(batch.requests.every(request=>request.signal.aborted),'all started transports are cleaned up');
 assert.equal(first.collection.deadlineReached,true);
 assert.ok(first.collection.sources.some(source=>source.status==='DEFERRED'));
 assert.equal(active,0);
 const split=calls.length;
 batch=createBatch();
 const secondStarted=clock,secondPromise=api.fetchLiveScoreMesh({deadlineMs:1000});
 await waitForStarts(2);
 assert.equal(active,2);
 clock=secondStarted+1000;
 for(const request of batch.requests)request.fail();
 const second=await secondPromise;
 const secondLeagues=calls.slice(split).filter(url=>url.includes('/scoreboard'));
 assert.equal(secondLeagues.length,2);
 assert.ok(secondLeagues.every(url=>!firstLeagues.includes(url)),'unfinished tail leagues are served before prior failures retry');
 assert.ok(batch.requests.every(request=>request.signal.aborted));
 assert.equal(second.collection.deadlineReached,true);
 assert.ok(peak<=2);
 assert.equal(active,0);
});

test('all primary scoreboards precede optional CDN details and the bounded detail queue rotates',async t=>{
 const savedFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=savedFetch});
 const api=acquisitionRuntime(['nba','nfl']),calls=[];
 const board=futureScoreboard();
 board.events=Array.from({length:20},(_,i)=>{
  const event=structuredClone(board.events[0]);event.id='live-'+i;event.competitions[0].id=event.id;
  event.status={type:{state:'in'}};event.competitions[0].status={type:{state:'in'}};
  return event;
 });
 globalThis.fetch=async url=>{
  url=String(url);calls.push(url);
  const native=nativeResponse(url);if(native)return native;
  if(url.includes('/basketball/nba/scoreboard'))return response(board);
  if(url.includes('/football/nfl/scoreboard'))return response({events:[]});
  if(url.includes('cdn.espn.com')){
   assert.ok(calls.some(value=>value.includes('/football/nfl/scoreboard')));
   return response({});
  }
  throw new Error('Unexpected request '+url);
 };
 await api.fetchLiveScoreMesh({deadlineMs:300});
 const firstDetails=calls.filter(url=>url.includes('cdn.espn.com'));
 assert.equal(firstDetails.length,12);
 assert.equal(calls.findIndex(url=>url.includes('cdn.espn.com')),4);
 const split=calls.length;
 const next=await api.fetchLiveScoreMesh({deadlineMs:300});
 const newDetails=calls.slice(split).filter(url=>url.includes('cdn.espn.com'));
 assert.equal(newDetails.length,8,'previously deferred details receive the next user-requested refresh');
 assert.ok(newDetails.every(url=>!firstDetails.includes(url)));
 assert.ok(next.collection.sources.every(source=>source.status==='CACHED'));
});

test('failed league refresh retains original references but a successful empty response clears that league',async t=>{
 const savedFetch=globalThis.fetch,SavedDate=Date;let clock=Date.now(),mode='valid';
 t.after(()=>{globalThis.fetch=savedFetch;globalThis.Date=SavedDate});
 globalThis.Date=class extends SavedDate{
  constructor(...args){super(...(args.length?args:[clock]))}
  static now(){return clock}
 };
 const api=acquisitionRuntime(['nba']);
 globalThis.fetch=async url=>{
  const native=nativeResponse(String(url));if(native)return native;
  if(mode==='failed')throw new Error('mock network unavailable');
  return response(mode==='valid'?futureScoreboard(clock):{events:[]});
 };
 const first=await api.fetchLiveScoreMesh();const originalTime=first.observedOdds.referenceQuotes[0].quoteObservedAt;
 clock+=31000;mode='failed';
 const failed=await api.fetchLiveScoreMesh();
 assert.equal(failed.observedOdds.referenceCount,6);
 assert.equal(failed.observedOdds.referenceQuotes[0].quoteObservedAt,originalTime);
 const status=failed.collection.sources.find(source=>source.label==='NBA');
 assert.equal(status.status,'CACHED');assert.match(status.error,/network unavailable/);
 clock+=1000;mode='empty';
 const cleared=await api.fetchLiveScoreMesh();
 assert.equal(cleared.observedOdds.referenceCount,0);
 assert.equal(cleared.collection.sources.find(source=>source.label==='NBA').status,'FETCHED');
});
