import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=name=>ts.transpileModule(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const inv=uri(read('src/lib/coverage-inventory.ts'));
const compiled=read('worker/d1-coverage.ts').replaceAll("from '../src/lib/coverage-inventory'","from "+JSON.stringify(inv));
const {d1CoverageGateway}=await import(uri(compiled));
const secret='a'.repeat(32),now=Date.now();
const rows=[{source_id:'approved-feed',event_id:'event-1',observed_at:new Date(now-5000).toISOString(),
 payload:JSON.stringify({provider:'approved-feed',kind:'odds',value:{bookmaker:'DraftKings',sport:'NBA',league:'NBA',marketType:'player_points',outcomeId:'over',startsAt:new Date(now+3600000).toISOString(),playerId:'player-123',line:'22.5',priceAmerican:-115}})}];
function env(data=rows){return {CRON_SECRET:secret,INTELLIGENCE_DB:{prepare(sql){assert.match(sql,/observation_kind='odds'/);return {bind(n){assert.ok(n<=250);return {all:async()=>({results:data})}}}}}};}
const req=(auth=true)=>new Request('https://edgeforce.example/api/operations/d1-pilot/coverage',{headers:auth?{authorization:'Bearer '+secret}:{}});
test('D1 coverage rejects unauthenticated callers without querying',async()=>{
 const response=await d1CoverageGateway(req(false),{CRON_SECRET:secret,INTELLIGENCE_DB:{prepare(){throw Error('unauthorized query')}}});
 assert.equal(response.status,401);
});
test('D1 coverage reads real stored prop lines from normalized envelope',async()=>{
 const response=await d1CoverageGateway(req(),env());
 assert.equal(response.status,200);
 const report=await response.json();
 assert.equal(report.freshDraftKingsQuotes,1);
 assert.equal(report.discovered.players,1);
 assert.equal(report.discovered.outcomes,1);
});
test('D1 coverage excludes stale observations without treating them as live quotes',async()=>{
 const old=[{...rows[0],observed_at:new Date(now-3600000).toISOString()}];
 const report=await (await d1CoverageGateway(req(),env(old))).json();
 assert.equal(report.freshDraftKingsQuotes,0);
 assert.equal(report.rejected.STALE_OR_FUTURE,1);
});
