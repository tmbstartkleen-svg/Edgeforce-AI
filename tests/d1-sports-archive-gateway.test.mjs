import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const writer=uri(fs.readFileSync(new URL('../src/lib/intelligence-core/d1-sports-market-store.mjs',import.meta.url),'utf8'));
const source=fs.readFileSync(new URL('../worker/d1-sports-archive-gateway.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
 .replaceAll("from '../src/lib/intelligence-core/d1-sports-market-store.mjs'","from "+JSON.stringify(writer));
const {d1SportsMarketArchiveIngest:ingest,d1SportsMarketArchiveReadiness:readiness}=await import(uri(js));
const secret='z'.repeat(36),cron='c'.repeat(36);
const now=Date.now(),utc=n=>new Date(n).toISOString();
const quote={sourceId:'licensed-primary',upstreamId:'independent-licensed-primary',sourceEventId:'game-42',
 sport:'NBA',league:'NBA',home:'Alpha',away:'Bravo',startTime:utc(now+3600000),
 market:'h2h',selection:'Alpha',bookmaker:'DraftKings',odds:-110,observedAt:now-2000};
const req=(method,route,payload,token)=>new Request('https://edgeforce.example/api/operations/d1-pilot/'+route,{
 method,headers:token?{'Authorization':'Bearer '+token,'Content-Type':'application/json'}:{},
 ...(payload===undefined?{}:{body:JSON.stringify(payload)})
});
const db=(options={})=>{
 const sqls=[],args=[];
 return {sqls,args,prepare(sql){sqls.push(sql);return {
  bind(...values){args.push(values);return this},
  async first(){
   if(sql.includes('WHERE source_id=? AND enabled=1'))return options.source??{upstream_id:quote.upstreamId,source_type:'ODDS'};
   if(sql.includes('MAX(source_observed_at)'))return options.count??{total:0,newest:null};
   if(sql.includes('COUNT(*) AS total FROM intelligence_sources'))return options.approved??{total:0};
   return {upstream_id:quote.upstreamId};
  },
  async run(){return {meta:{changes:options.changes??1}}},
  async all(){return {results:options.rows??[]}}
 }}};
};
test('missing credentials cannot query or write D1',async()=>{
 const safe=db();const env={INGEST_SECRET:secret,CRON_SECRET:cron,INTELLIGENCE_DB:safe,D1_SPORTS_MARKET_ARCHIVE_ENABLED:'true'};
 assert.equal((await ingest(req('POST','sports-market-ingest',[quote]),env)).status,401);
 assert.equal((await readiness(req('GET','sports-market-readiness'),env)).status,401);
 assert.equal(safe.sqls.length,0);
});
test('production and staging archive writes default to disabled',async()=>{
 const env={INGEST_SECRET:secret,INTELLIGENCE_DB:db()};
 const res=await ingest(req('POST','sports-market-ingest',[quote],secret),env);
 assert.equal(res.status,503);assert.equal((await res.json()).reason,'SPORTS_ARCHIVE_WRITE_DISABLED');
 const wrangler=JSON.parse(fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(wrangler.vars.D1_SPORTS_MARKET_ARCHIVE_ENABLED,'false');
 const config=fs.readFileSync(new URL('../scripts/build-isolated-staging-config.mjs',import.meta.url),'utf8');
 assert.match(config,/D1_SPORTS_MARKET_ARCHIVE_ENABLED:'false'/);
});
test('invalid price, oversized batches and stale price are rejected before SQL',async()=>{
 const d=db();const env={INGEST_SECRET:secret,INTELLIGENCE_DB:d,D1_SPORTS_MARKET_ARCHIVE_ENABLED:'true'};
 for(const x of [{...quote,odds:0},{...quote,observedAt:now-3600_000},{...quote,sourceId:''}]){
  assert.equal((await ingest(req('POST','sports-market-ingest',[x],secret),env)).status,400);
 }
 assert.equal((await ingest(req('POST','sports-market-ingest',Array(26).fill(quote),secret),env)).status,400);
 assert.equal(d.sqls.length,0);
});
test('a disabled or wrong-category source cannot archive even when write flag is on',async()=>{
 const d=db({source:null}),env={INGEST_SECRET:secret,INTELLIGENCE_DB:d,D1_SPORTS_MARKET_ARCHIVE_ENABLED:'true'};
 assert.equal((await ingest(req('POST','sports-market-ingest',[quote],secret),env)).status,403);
 const wrong=db({source:{upstream_id:quote.upstreamId,source_type:'CERTIFICATION_ONLY'}});
 assert.equal((await ingest(req('POST','sports-market-ingest',[quote],secret),{...env,INTELLIGENCE_DB:wrong})).status,403);
 const alias=db({source:{upstream_id:'another-network',source_type:'ODDS'}});
 assert.equal((await ingest(req('POST','sports-market-ingest',[quote],secret),{...env,INTELLIGENCE_DB:alias})).status,403);
 assert.equal(d.sqls.some(s=>s.includes('INSERT')),false);
});
test('approved odds quotes are archived with source timestamp and provenance',async()=>{
 const d=db(),env={INGEST_SECRET:secret,INTELLIGENCE_DB:d,D1_SPORTS_MARKET_ARCHIVE_ENABLED:'true'};
 const res=await ingest(req('POST','sports-market-ingest',[quote],secret),env);
 assert.equal(res.status,200);
 const v=await res.json();
 assert.equal(v.inserted,1);assert.equal(v.independentVerificationCertified,false);
 assert.ok(d.sqls.some(s=>s.includes('INSERT OR IGNORE INTO sports_market_snapshots')));
 assert.ok(d.args.some(row=>row.includes(utc(quote.observedAt))));
});
test('readiness explicitly reports no archive despite credentials',async()=>{
 const d=db();const res=await readiness(req('GET','sports-market-readiness',undefined,cron),{CRON_SECRET:cron,INTELLIGENCE_DB:d});
 assert.equal(res.status,200);const v=await res.json();
 assert.equal(v.status,'NO_ARCHIVED_ODDS');
 assert.equal(v.freshApprovedSampleRows,0);
 assert.equal(v.marketCoverageComplete,false);
 assert.equal(v.independentFairOddsCertified,false);
});
test('multiple bookmakers from a single upstream are degraded rather than cross-verified',async()=>{
 const rows=[{source_id:'feed',upstream_id:'one-upstream',source_event_id:'a',sport:'NBA',league:'NBA',market_key:'h2h',
 selection_key:'Alpha',bookmaker:'DraftKings',source_observed_at:utc(now-2000)},
 {source_id:'feed',upstream_id:'one-upstream',source_event_id:'a',sport:'NBA',league:'NBA',market_key:'h2h',
 selection_key:'Alpha',bookmaker:'FanDuel',source_observed_at:utc(now-2000)}];
 const d=db({rows,count:{total:2,newest:utc(now-2000)},approved:{total:1}});
 const v=await (await readiness(req('GET','sports-market-readiness',undefined,cron),{CRON_SECRET:cron,INTELLIGENCE_DB:d})).json();
 assert.equal(v.status,'SINGLE_UPSTREAM_DEGRADED');assert.equal(v.independentUpstreams,1);
 assert.deepEqual(v.bookmakers,['DraftKings','FanDuel']);
 assert.equal(v.crossBookMarketsVerified,0);
});
test('inventory from two upstreams is still not certified as matched-market consensus',async()=>{
 const base={source_id:'feed',upstream_id:'one-upstream',source_event_id:'a',sport:'NBA',league:'NBA',market_key:'h2h',
 selection_key:'Alpha',bookmaker:'DraftKings',source_observed_at:utc(now-2000)};
 const d=db({rows:[base,{...base,upstream_id:'different-upstream',source_event_id:'other'}],
  count:{total:2,newest:base.source_observed_at},approved:{total:2}});
 const v=await (await readiness(req('GET','sports-market-readiness',undefined,cron),{CRON_SECRET:cron,INTELLIGENCE_DB:d})).json();
 assert.equal(v.status,'MULTIPLE_UPSTREAM_INVENTORY_ONLY');
 assert.equal(v.crossBookMarketsVerified,0);assert.equal(v.expectedValueCertified,false);
});
