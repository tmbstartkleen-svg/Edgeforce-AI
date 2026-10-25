import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import * as core from '../src/lib/intelligence-core/sports-evidence.mjs';
import * as engine from '../src/lib/intelligence-core/market-opportunity-engine.mjs';
import * as identity from '../src/lib/intelligence-core/market-identity-and-movement.mjs';
const now=Date.parse('2026-10-25T12:00:00Z');
const input={source_id:'network',upstream_id:'origin',event_id:'event-1',payload_hash:'b'.repeat(64),observed_at:new Date(now-1000).toISOString()};
const quote={source_event_id:'event-1',market_key:'moneyline',selection_key:'home',payload_sha256:'a'.repeat(64)};
const run={event_id:'event-1',market_key:'moneyline',selection_key:'home',run_count:1000,model_version:'v1',created_at:new Date(now).toISOString(),feature_snapshot:JSON.stringify({quotePayloadSha256:quote.payload_sha256,monteCarlo:{runs:1000,hits:650},inputEvidence:[input]})};
test('MC uses actual hits and trials, with a bounded sampling interval',()=>{
 const result=core.monteCarloForQuote(quote,[{...run,model_probability:.99}],[input],now);
 assert.equal(result.percent,65);assert.equal(result.runs,1000);assert.equal(result.calibrated,false);
 assert.ok(result.low<65&&result.high>65&&result.low>0&&result.high<100);
});
test('no fallback from generic or market-implied probabilities',()=>{
 assert.equal(core.monteCarloForQuote(quote,[{...run,feature_snapshot:'{}',model_probability:.99}],[],now),null);
});
test('wrong quote, event, market, selection, stale runs and missing inputs are rejected',()=>{
 for(const patch of [{event_id:'other'},{market_key:'spread'},{selection_key:'away'},{created_at:new Date(now-1200001).toISOString()},{created_at:new Date(now+1).toISOString()},{feature_snapshot:'invalid'},{run_count:1001}])assert.equal(core.monteCarloForQuote(quote,[{...run,...patch}],[input],now),null);
 assert.equal(core.monteCarloForQuote({...quote,payload_sha256:'c'.repeat(64)},[run],[input],now),null);
 assert.equal(core.monteCarloForQuote(quote,[run],[],now),null);
 assert.equal(core.monteCarloForQuote(quote,[run],[{...input,upstream_id:'wrong'}],now),null);
});
test('invalid trial counts and unobserved/late input references are rejected',()=>{
 const base=JSON.parse(run.feature_snapshot);
 for(const mc of [{runs:99,hits:50},{runs:1000,hits:1001},{runs:1000,hits:-1},{runs:1000,hits:1.5}])assert.equal(core.monteCarloForQuote(quote,[{...run,feature_snapshot:JSON.stringify({...base,monteCarlo:mc})}],[input],now),null);
 const later={...input,observed_at:new Date(now+1).toISOString()};
 assert.equal(core.monteCarloForQuote(quote,[{...run,feature_snapshot:JSON.stringify({...base,inputEvidence:[later]})}],[later],now),null);
});
test('all registered sports remain visible and score feeds never imply odds coverage',()=>{
 const rows=core.buildSportsCoverage([{id:'epl',label:'EPL',family:'soccer'},{id:'tennis-atp',label:'ATP',family:'tennis'},{id:'ncaam-basketball',label:'NCAAB',family:'basketball'}],[{source_id:'espn-scoreboard-soccer-epl',total:3,latest:new Date(now-2*86400000).toISOString()},{source_id:'espn-scoreboard-ncaab',total:2,latest:new Date(now).toISOString()}],now);
 assert.equal(rows.length,3);assert.equal(rows[0].status,'STALE_STORED_SCORES');assert.equal(rows[1].status,'NO_STORED_SCORES');assert.equal(rows[2].observations,2);
});
function load(path,dependencies={}){
 const exports={};
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>{if(!(name in dependencies))throw Error(name);return dependencies[name]},Response,Request,Date,Map,Set,URL});return exports;
}
const registry=load('src/lib/sportRegistry.ts');
const normalizer=load('worker/d1-sportsbook-opportunity-review.ts',{'../src/lib/intelligence-core/market-opportunity-engine.mjs':engine,'../src/lib/intelligence-core/market-identity-and-movement.mjs':identity});
const {d1SportsEvidence}=load('worker/d1-sports-evidence.ts',{'node:crypto':crypto,'../src/lib/sportRegistry':registry,'./d1-sportsbook-opportunity-review':normalizer,'../src/lib/intelligence-core/sports-evidence.mjs':core});
const token='test-operator-token-32-characters';
test('authentication precedes all reads from both stores',async()=>{
 const db={prepare(){throw Error('must not access')}};
 const response=await d1SportsEvidence(new Request('https://example.test'),{CRON_SECRET:token,INTELLIGENCE_DB:db,SPORTS_NETWORK_DB:db});assert.equal(response.status,401);
});
test('empty stores expose the full registry with unavailable odds and no writes',async()=>{
 const queries=[];const db={prepare(sql){assert.match(sql,/^SELECT /);queries.push(sql);return {bind(){return {all:async()=>({results:[]})}}}}};
 const response=await d1SportsEvidence(new Request('https://example.test',{headers:{authorization:'Bearer '+token}}),{CRON_SECRET:token,INTELLIGENCE_DB:db,SPORTS_NETWORK_DB:db});
 const data=await response.json();assert.equal(response.status,200);assert.equal(data.coverage.length,registry.GLOBAL_SPORT_REGISTRY.length);assert.equal(data.rows.length,0);assert.equal(data.completeCoverageCertified,false);assert.equal(data.externalRequests,0);assert.equal(queries.length,4);
});
test('missing network binding fails explicitly rather than presenting zero coverage',async()=>{
 const response=await d1SportsEvidence(new Request('https://example.test',{headers:{authorization:'Bearer '+token}}),{CRON_SECRET:token,INTELLIGENCE_DB:{prepare(){}}});assert.equal(response.status,503);
});
test('real archive identity and checksum gate the odds beside simulation columns',async()=>{
 const time=Date.now();
 const raw={sourceId:'approved',upstreamId:'origin',sourceEventId:'event',market:'moneyline',selection:'home',bookmaker:'Book',odds:-110,observedAt:time-1000,settlementKey:'full-time',outcomeSetType:'TWO_WAY',outcomes:['home','away'],currency:'USD',venueType:'SPORTSBOOK',sport:'nfl',league:'NFL',home:'Home',away:'Away',startTime:new Date(time+3600000).toISOString()};
 const text=JSON.stringify(raw);
 const row={source_id:raw.sourceId,upstream_id:raw.upstreamId,source_event_id:raw.sourceEventId,market_key:raw.market,selection_key:raw.selection,bookmaker:raw.bookmaker,american_odds:raw.odds,source_observed_at:new Date(raw.observedAt).toISOString(),raw_json:text,payload_sha256:crypto.createHash('sha256').update(text).digest('hex'),sport:raw.sport,league:raw.league,home_team:raw.home,away_team:raw.away,start_time:raw.startTime};
 const check=async change=>{
  const db={prepare(sql){return {bind(){return {all:async()=>({results:sql.includes('FROM sports_market_snapshots')?[{...row,...change}]:sql.includes("source_type='ODDS'")?[{source_id:'approved',upstream_id:'origin'}]:[]})}}}}};
  return (await d1SportsEvidence(new Request('https://example.test',{headers:{authorization:'Bearer '+token}}),{CRON_SECRET:token,INTELLIGENCE_DB:db,SPORTS_NETWORK_DB:db})).json();
 };
 const data=await check({});assert.equal(data.rows.length,1);assert.equal(data.rows[0].odds,-110);assert.equal(data.rows[0].monteCarlo,null);
 assert.equal((await check({sport:'tennis'})).rows.length,0);
 assert.equal((await check({payload_sha256:'0'.repeat(64)})).rows.length,0);
});
