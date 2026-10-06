import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/providers/theRundown.ts',import.meta.url),'utf8')
 .replace(/import type .*?;\n/g,'');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const runtime=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));

test('normalizes three free books',()=>{
 const payload={events:[{event_id:'evt1',event_date:'2026-10-07T00:00:00Z',
  teams:[{name:'Away Team',is_away:true},{name:'Home Team',is_away:false}],
  markets:[{market_id:1,name:'moneyline',participants:[
   {id:1,name:'Away Team',lines:[{prices:{'19':{price:120,updated_at:'2026-10-06T20:00:00Z'},'23':{price:118,updated_at:'2026-10-06T20:01:00Z'}}}]},
   {id:2,name:'Home Team',lines:[{prices:{'22':{price:-130,updated_at:'2026-10-06T20:02:00Z'}}}]}
  ]},{market_id:2,name:'spread',participants:[
   {id:1,name:'Away Team',lines:[{value:'+3.5',prices:{'19':{price:-110,updated_at:'2026-10-06T20:00:00Z'}}}]},
   {id:2,name:'Home Team',lines:[{value:'-3.5',prices:{'23':{price:-108,updated_at:'2026-10-06T20:00:00Z'}}}]}
  ]}]}]};
 const rows=runtime.normalizeTheRundownPayload(payload,'2',300,'2026-10-06T21:45:00Z');
 assert.equal(rows.length,5);
 assert.equal(rows[0].bookmaker,'DraftKings');
 assert.equal(rows[0].league,'NFL');
 assert.equal(rows[0].liveEligible,false);
 assert.equal(rows[0].sourceDelaySeconds,300);
 assert.equal(rows[0].pulledAt,'2026-10-06T21:45:00Z');
 assert.equal(rows[0].sourceUpdatedAt,'2026-10-06T20:00:00Z');
 assert.ok(rows.some(x=>x.selection==='Away Team +3.5'));
});

test('ignores unknown books and invalid prices',()=>{
 const payload={events:[{event_id:'evt2',event_date:'2026-10-07T00:00:00Z',
  teams:[{name:'A',is_away:true},{name:'B',is_away:false}],
  markets:[{market_id:1,name:'moneyline',participants:[
   {id:1,name:'A',lines:[{prices:{'99':{price:140,updated_at:'2026-10-06T20:00:00Z'},'19':{price:0.0001,updated_at:'2026-10-06T20:00:00Z'}}}]}
  ]}]}]};
 assert.equal(runtime.normalizeTheRundownPayload(payload,'2',300).length,0);
});

test('adapter is opt-in and quota-protective',()=>{
 assert.equal(runtime.theRundownProvider({THERUNDOWN_API_KEY:'test-value',THERUNDOWN_ENABLED:'false'}),null);
 const p=runtime.theRundownProvider({THERUNDOWN_API_KEY:'test-value',THERUNDOWN_ENABLED:'true'});
 assert.ok(p);
 assert.equal(p.priority,110);
 assert.match(source,/THERUNDOWN_CACHE_MS\|\|1800000/);
 assert.match(source,/THERUNDOWN_SPORTS_PER_BATCH\|\|4/);
 assert.match(source,/THERUNDOWN_MIN_REMAINING\|\|2500/);
});


test('fresh observation time is independent from unchanged sportsbook line time',()=>{
 const payload={events:[{event_id:'evt3',event_date:'2026-10-07T00:00:00Z',
  teams:[{name:'Away',is_away:true},{name:'Home',is_away:false}],
  markets:[{market_id:1,name:'moneyline',participants:[
   {id:1,name:'Away',lines:[{prices:{'19':{price:125,updated_at:'2026-10-04T12:00:00Z'}}}]}
  ]}]}]};
 const rows=runtime.normalizeTheRundownPayload(payload,'1',300,'2026-10-06T21:45:00Z');
 assert.equal(rows.length,1);
 assert.equal(rows[0].pulledAt,'2026-10-06T21:45:00Z');
 assert.equal(rows[0].sourceUpdatedAt,'2026-10-04T12:00:00Z');
});
