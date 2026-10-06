import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/liveScoreMesh.ts',import.meta.url),'utf8');
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

test('mesh source contains one-second adaptive fast path and broad backup coverage',()=>{
 assert.match(source,/LIVE_SCORE_ESPN_CDN_LIVE_CACHE_MS\|\|1000/);
 assert.match(source,/uiRefreshMs:1000/);
 for(const marker of ['womens-college-basketball','college-baseball','uefa.champions','australian-football','rugby-league'])assert.ok(source.includes(marker),marker);
 assert.ok(source.includes("source:'espn-cdn'"));
});
