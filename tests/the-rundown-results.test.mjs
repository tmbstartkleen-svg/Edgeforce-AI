import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/providers/theRundownResults.ts',import.meta.url),'utf8').replace(/import type .*?;\n/g,'');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const runtime=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));

const payload={events:[{
 event_id:'evt-final',
 status:'final',
 teams:[{name:'Away',is_away:true},{name:'Home',is_away:false}],
 score:{score_away:20,score_home:27},
 markets:[
  {name:'moneyline',participants:[
   {id:'a',name:'Away',lines:[{value:null}]},
   {id:'h',name:'Home',lines:[{value:null}]}
  ]},
  {name:'spread',participants:[
   {id:'a',name:'Away',lines:[{value:'+7'}]},
   {id:'h',name:'Home',lines:[{value:'-7'}]}
  ]},
  {name:'total',participants:[
   {id:'o',name:'Over',lines:[{value:'47'}]},
   {id:'u',name:'Under',lines:[{value:'47'}]}
  ]}
 ]
}]};

test('settles final moneyline, spread and total without guessing',()=>{
 const rows=runtime.normalizeTheRundownResults(payload,'2026-10-06T22:00:00Z');
 const by=(market,selection)=>rows.find(x=>x.marketKey===market&&x.selectionKey===selection)?.result;
 assert.equal(by('h2h','Home'),'win');
 assert.equal(by('h2h','Away'),'loss');
 assert.equal(by('spreads','Away +7'),'push');
 assert.equal(by('spreads','Home -7'),'push');
 assert.equal(by('totals','Over 47'),'push');
 assert.equal(by('totals','Under 47'),'push');
 assert.ok(rows.every(x=>x.eventId==='evt-final'));
});

test('rejects scored events that are not explicitly final',()=>{
 const live=structuredClone(payload);
 live.events[0].status='in';
 assert.equal(runtime.normalizeTheRundownResults(live).length,0);
});

test('rejects final events without numeric scores',()=>{
 const bad=structuredClone(payload);
 bad.events[0].score={};
 assert.equal(runtime.normalizeTheRundownResults(bad).length,0);
});

test('results provider reuses the same protected key and is opt-out',()=>{
 const p=runtime.theRundownResultsProvider({THERUNDOWN_API_KEY:'test-key',THERUNDOWN_ENABLED:'true'});
 assert.ok(p);
 assert.equal(p.capability,'RESULTS');
 assert.equal(p.quarantineMin,1);
 assert.equal(runtime.theRundownResultsProvider({THERUNDOWN_API_KEY:'test-key',THERUNDOWN_ENABLED:'true',THERUNDOWN_RESULTS_ENABLED:'false'}),null);
});
