import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/providers/sportScore.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const runtime=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));

test('SportScore parser normalizes live match state and scores',()=>{
 const rows=runtime.parseSportScoreMatches({
  sport:'tennis',updated:'2026-10-06T21:45:00Z',
  matches:[{home:'Player A',away:'Player B',home_score:1,away_score:0,status:'live',status_text:'Set 2',time:'2026-10-06T21:30:00Z',slug:'a-v-b'}]
 },'tennis');
 assert.equal(rows.length,1);
 assert.equal(rows[0].status,'LIVE');
 assert.equal(rows[0].source,'sportscore');
 assert.equal(rows[0].home.score,1);
 assert.equal(rows[0].away.score,0);
 assert.equal(rows[0].observedAt,'2026-10-06T21:45:00Z');
});

test('SportScore parser maps final and scheduled statuses',()=>{
 const rows=runtime.parseSportScoreMatches({matches:[
  {home:'A',away:'B',status:'finished',status_text:'Final',slug:'f'},
  {home:'C',away:'D',status:'upcoming',status_text:'Scheduled',slug:'s'}
 ]},'football');
 assert.equal(rows[0].status,'FINAL');
 assert.equal(rows[1].status,'SCHEDULED');
});

test('SportScore remains opt-in and carries required attribution',async()=>{
 const old=process.env.SPORTSCORE_ENABLED;
 process.env.SPORTSCORE_ENABLED='false';
 try{
  const result=await runtime.fetchSportScoreBackup();
  assert.equal(result.enabled,false);
  assert.equal(result.attribution.required,true);
  assert.equal(result.attribution.label,'Powered by SportScore');
  assert.equal(result.games.length,0);
 }finally{
  if(old===undefined)delete process.env.SPORTSCORE_ENABLED;
  else process.env.SPORTSCORE_ENABLED=old;
 }
});

test('SportScore default cadence is no faster than provider edge cache',()=>{
 assert.match(source,/SPORTSCORE_CACHE_MS\|\|60000/);
 assert.match(source,/sportscore\.com\/api\/widget\/matches/);
 assert.match(source,/SPORTSCORE_ENABLED/);
});
