import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=p=>ts.transpileModule(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=x=>'data:text/javascript;base64,'+Buffer.from(x).toString('base64');
const verifier=uri(compile('src/lib/d1-odds-readback-verification.ts'));
const compiled=compile('src/lib/d1-odds-readback-adapter.ts')
 .replace("from './d1-odds-readback-verification'","from "+JSON.stringify(verifier));
const {readAndVerifyD1OddsBatch}=await import(uri(compiled));
const now=Date.parse('2026-10-23T12:00:00Z');
const observedAt=now-30000;
const value={bookmaker:'DraftKings',sport:'basketball_nba',league:'NBA',marketType:'h2h',
 outcomeId:'Home',startsAt:'2026-10-23T19:00:00Z',priceAmerican:-115};
const expected={provider:'the-odds-api',upstreamId:'api.the-odds-api.com',
 eventId:'evt-one',marketId:'h2h',observedAt,kind:'odds',value};
const row={source_id:expected.provider,upstream_id:expected.upstreamId,event_id:expected.eventId,
 market_id:expected.marketId,observation_kind:'odds',observed_at:new Date(observedAt).toISOString(),
 payload:JSON.stringify(value)};
function fake(rows){
 const statements=[];
 return {statements,prepare(sql){
  assert.match(sql,/^SELECT/);
  assert.match(sql,/INNER JOIN intelligence_sources/);
  assert.match(sql,/s\.upstream_id=o\.upstream_id AND s\.enabled=1/);
  assert.match(sql,/o\.observation_kind='odds'/);
  const s={sql,bind(...args){statements.push({sql,args});return {all:async()=>({results:rows})}}};
  return s;
 }};
}
test('read-only D1 adapter binds source, owner and event before exact-price verification',async()=>{
 const db=fake([row]);
 const report=await readAndVerifyD1OddsBatch(db,[expected],now);
 assert.equal(report.exactReadbackComplete,true);
 assert.equal(report.readbackMatches,1);
 assert.equal(report.releaseCertified,false);
 assert.equal(report.writesPerformed,0);
 assert.equal(report.readOnly,true);
 assert.deepEqual(db.statements[0].args.slice(0,3),['the-odds-api','api.the-odds-api.com','evt-one']);
});
test('adapter blocks mixed sources before any D1 access',async()=>{
 const db=fake([row]);
 await assert.rejects(()=>readAndVerifyD1OddsBatch(db,[expected,{...expected,upstreamId:'other-upstream'}],now),/MIXED_ODDS_SOURCE_BATCH/);
 assert.equal(db.statements.length,0);
});
test('query saturation cannot yield a false completeness certificate',async()=>{
 const db=fake(Array(250).fill(row));
 const report=await readAndVerifyD1OddsBatch(db,[expected],now);
 assert.equal(report.exactReadbackComplete,false);
 assert.equal(report.querySaturated,true);
 assert.equal(report.readbackWarning,'D1_QUERY_CAP_REACHED_UNABLE_TO_CERTIFY');
});
test('no matching D1 rows is not a successful readback',async()=>{
 const report=await readAndVerifyD1OddsBatch(fake([]),[expected],now);
 assert.equal(report.readbackMatches,0);
 assert.equal(report.exactReadbackComplete,false);
 assert.equal(report.rejected.EXPECTED_QUOTE_MISSING,1);
});
