import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const compile=source=>import('data:text/javascript,'+encodeURIComponent(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText));
const registry=await compile(readFileSync(new URL('../src/lib/sportRegistry.ts',import.meta.url),'utf8'));
let source=readFileSync(new URL('../src/lib/gameSchedule.ts',import.meta.url),'utf8').replace(/import \{ESPN_SCOREBOARD_FEEDS\} from '.\/sportRegistry';/,`const ESPN_SCOREBOARD_FEEDS=${JSON.stringify(registry.ESPN_SCOREBOARD_FEEDS)};`).replace(/import \{normalizeEspnOddsItems\} from '.\/providers\/espnCoreOdds';/,`const normalizeEspnOddsItems=()=>[];`);
const runtime=await compile(source);
const game=(id,date,state='pre')=>({id,date,competitions:[{id,date,competitors:[{homeAway:'home',team:{displayName:'Home'},score:'2'},{homeAway:'away',team:{displayName:'Away'},score:'1'}],status:{type:{state,shortDetail:'Final'}}}]});
test('Eastern date handles midnight and daylight saving transitions',()=>{
 assert.equal(runtime.easternDay(0,Date.parse('2026-10-11T02:00:00Z')),'2026-10-10');
 assert.equal(runtime.easternDay(1,Date.parse('2026-11-01T04:30:00Z')),'2026-11-02');
});
test('schedule includes unquoted, live and finished games and filters by Eastern date',()=>{
 const rows=runtime.normalizeSchedule({events:[game('a','2026-10-11T02:00:00Z'),game('b','2026-10-10T18:00:00Z','in'),game('c','2026-10-10T17:00:00Z','post'),game('d','2026-10-11T17:00:00Z')]},'NHL','2026-10-10');
 assert.equal(rows.length,3);assert.ok(rows.every(g=>g.quotes.length===0));assert.ok(rows.some(g=>g.state==='post'));assert.ok(rows.some(g=>g.state==='in'));
});
test('every competition is included for multi-match events',()=>{
 const first=game('one','2026-10-10T18:00:00Z');
 first.competitions.push({...first.competitions[0],id:'two'});
 assert.equal(runtime.normalizeSchedule({events:[first]},'UFC','2026-10-10').length,2);
});
test('bounded batches preserve successful feeds when another league fails and coalesce requests',async()=>{
 const original=globalThis.fetch;const urls=[];
 globalThis.fetch=async url=>{urls.push(String(url));if(urls.length===2)throw new Error('provider unavailable');return Response.json({events:[game(String(url),'2026-10-10T18:00:00Z')]});};
 try{
  const [a,b]=await Promise.all([runtime.loadSchedule('2026-10-10',0),runtime.loadSchedule('2026-10-10',0)]);
  assert.equal(urls.length,8);assert.equal(a.games.length,7);assert.equal(a.feeds.filter(f=>f.error).length,1);assert.deepEqual(a,b);
  assert.ok(urls.every(u=>u.includes('dates=20261010')&&u.includes('limit=200')));
  assert.ok(urls.some(u=>u.includes('groups=80')));assert.ok(urls.some(u=>u.includes('groups=81')));
  await runtime.loadSchedule('2026-10-10',0,'nhl');
  assert.equal(urls.length,9);assert.ok(!urls[8].includes('groups='));
  await runtime.loadSchedule('2026-10-10',0);assert.equal(urls.length,9);
 }finally{globalThis.fetch=original;}
});
test('HTTP success with empty event objects is reported as a failed schedule feed',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({events:[{},{}]});
 try{
  const result=await runtime.loadSchedule('2026-10-11',0,'nhl');
  assert.equal(result.games.length,0);assert.equal(result.feeds[0].ok,false);assert.match(result.feeds[0].error,/Incomplete schedule/);
 }finally{globalThis.fetch=original;}
});
