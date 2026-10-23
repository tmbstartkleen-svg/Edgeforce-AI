import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../src/lib/'+p,import.meta.url),'utf8');
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const math=uri(ts.transpileModule(read('math.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const normalized=ts.transpileModule(read('providers/normalizeOdds.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
 .replace("from '../math'","from "+JSON.stringify(math));
const {normalizeOddsPayload}=await import(uri(normalized));
const event=(last_update,extra={})=>[{id:'event-1',sport_key:'basketball_nba',sport_title:'NBA',
 commence_time:new Date(Date.now()+3600000).toISOString(),home_team:'Home',away_team:'Away',
 bookmakers:[{key:'draftkings',title:'DraftKings',...(last_update===undefined?{}:{last_update}),
 markets:[{key:'h2h',...(last_update===undefined?{}:{last_update}),outcomes:[{name:'Home',price:-115},{name:'Away',price:105}]}]}],...extra}];
test('The Odds API bookmaker timestamp determines source age, not server normalization time',()=>{
 const stamp=new Date(Date.now()-4*60000).toISOString();
 const rows=normalizeOddsPayload(event(stamp)).markets;
 assert.equal(rows.length,2);
 assert.ok(rows.every(r=>r.sourceAgeMin>=3.9&&r.sourceAgeMin<=4.2));
 assert.ok(rows.every(r=>r.sourceTimestamp===stamp));
});
test('stale bookmaker timestamp stays stale and cannot be shown as a fresh quote',()=>{
 const stamp=new Date(Date.now()-45*60000).toISOString();
 const rows=normalizeOddsPayload(event(stamp)).markets;
 assert.ok(rows.every(r=>r.sourceAgeMin>=44.9));
 assert.ok(rows.every(r=>r.sourceAgeMin>15));
});
test('missing or future bookmaker timestamps are never assigned age zero',()=>{
 const missing=normalizeOddsPayload(event(undefined)).markets;
 assert.ok(missing.every(r=>r.sourceAgeMin>15));
 const future=normalizeOddsPayload(event(new Date(Date.now()+3600000).toISOString())).markets;
 assert.ok(future.every(r=>r.sourceAgeMin>15));
 assert.ok(future.every(r=>!r.sourceTimestamp));
});
