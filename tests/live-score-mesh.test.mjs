import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const registrySource=readFileSync(new URL('../src/lib/sportRegistry.ts',import.meta.url),'utf8');
const registryCompiled=ts.transpileModule(registrySource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(registryCompiled.diagnostics.length,0);
const registry=await import('data:text/javascript,'+encodeURIComponent(registryCompiled.outputText));
const sourceRaw=readFileSync(new URL('../src/lib/liveScoreMesh.ts',import.meta.url),'utf8');
const registryInline=`const ESPN_SCOREBOARD_FEEDS=${JSON.stringify(registry.ESPN_SCOREBOARD_FEEDS)};const sportCoverageSummary=()=>(${JSON.stringify(registry.sportCoverageSummary())});`;
const sportScoreStub=`const fetchSportScoreBackup=async()=>({enabled:false,games:[],warnings:[],attribution:{required:true,label:'Powered by SportScore',url:'https://sportscore.com/'}});`;
const communityStub=`const fetchCommunityScoreBackups=async()=>({games:[],warnings:[],sourceState:[]});`;
const source=sourceRaw
 .replace(/import\s*\{ESPN_SCOREBOARD_FEEDS,sportCoverageSummary\}\s*from\s*['\"]\.\/sportRegistry['\"];?/,registryInline)
 .replace(/import\s*\{fetchSportScoreBackup\}\s*from\s*['\"]\.\/providers\/sportScore['\"];?/,sportScoreStub)
 .replace(/import\s*\{fetchCommunityScoreBackups\}\s*from\s*['\"]\.\/providers\/communityScoreBackups['\"];?/,communityStub);
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const runtime=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));

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

test('live scoreboard fan-out stays within the invocation budget and preserves base observations',async()=>{
 const original=globalThis.fetch,limit=process.env.LIVE_SCORE_MAX_REQUESTS;let calls=0;
 process.env.LIVE_SCORE_MAX_REQUESTS='45';
 globalThis.fetch=async url=>{calls++;return Response.json(String(url).includes('/scoreboard')?{events:[0,1].map(i=>({id:'live-'+i,date:new Date().toISOString(),status:{type:{state:'in',detail:'In Progress'},displayClock:'05:00'},competitions:[{competitors:[{homeAway:'home',team:{displayName:'Home '+i},score:'3'},{homeAway:'away',team:{displayName:'Away '+i},score:'2'}]}]}))}:{});};
 try{
  const result=await runtime.fetchLiveScoreMesh();
  assert.equal(calls,45);assert.equal(result.transport.requests,45);assert.equal(result.transport.requestLimit,45);
  assert.ok(result.games.length>30);assert.ok(result.games.some(g=>g.home.score===3&&g.away.score===2));
  assert.equal(runtime.getLiveScoreMeshSnapshot(),result);
 }finally{globalThis.fetch=original;if(limit===undefined)delete process.env.LIVE_SCORE_MAX_REQUESTS;else process.env.LIVE_SCORE_MAX_REQUESTS=limit;}
});
