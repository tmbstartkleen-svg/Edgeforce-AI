import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/providers/communityScoreBackups.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const runtime=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));

test('V144 parses TheSportsDB schedule and score rows',()=>{
 const rows=runtime.parseTheSportsDb({events:[{
  idEvent:'1',strSport:'Basketball',strLeague:'NBA',strStatus:'Match Finished',
  strTimestamp:'2026-10-07T01:00:00Z',strHomeTeam:'Home A',strAwayTeam:'Away B',
  intHomeScore:'112',intAwayScore:'108'
 }]},'Basketball');
 assert.equal(rows.length,1);
 assert.equal(rows[0].status,'FINAL');
 assert.equal(rows[0].home.score,112);
 assert.equal(rows[0].source,'thesportsdb');
});

test('V144 parses football-data.org live soccer rows',()=>{
 const rows=runtime.parseFootballData({matches:[{
  id:99,status:'IN_PLAY',utcDate:'2026-10-07T18:00:00Z',
  competition:{name:'Premier League'},homeTeam:{name:'A'},awayTeam:{name:'B'},
  score:{fullTime:{home:2,away:1}}
 }]});
 assert.equal(rows[0].status,'LIVE');
 assert.equal(rows[0].league,'Premier League');
 assert.equal(rows[0].home.score,2);
});

test('V144 parses Big Balls unified score rows',()=>{
 const rows=runtime.parseBigBalls({data:[{
  id:'m1',sport:'basketball',league:'NBA',status:'live',
  home:{name:'A'},away:{name:'B'},score:{home:77,away:73},start_time:'2026-10-07T20:00:00Z'
 }]});
 assert.equal(rows[0].status,'LIVE');
 assert.equal(rows[0].source,'bigballsdata');
 assert.equal(rows[0].away.score,73);
});

test('V144 parses API-Sports fixture rows',()=>{
 const rows=runtime.parseApiSports({response:[{
  fixture:{id:4,date:'2026-10-07T19:00:00Z',status:{long:'Second Half',elapsed:61}},
  league:{name:'League 1'},teams:{home:{name:'A'},away:{name:'B'}},goals:{home:1,away:0}
 }]},'api-sports-football');
 assert.equal(rows[0].status,'LIVE');
 assert.equal(rows[0].clock,'61');
 assert.equal(rows[0].home.score,1);
});

test('V144 free score backups remain quota-conscious and key-optional',()=>{
 assert.match(source,/THESPORTSDB_ENABLED/);
 assert.match(source,/api\/v1\/json\/123\/eventsday\.php/);
 assert.match(source,/football-data\.org\/v4\/matches/);
 assert.match(source,/6\*60_000,bigBalls/);
 assert.match(source,/15\*60_000,apiSports/);
 assert.match(source,/if\(!key\)return \[\]/);
});
