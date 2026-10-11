import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const result=ts.transpileModule(read('../src/lib/firstPartySportsNetwork.ts'),
 {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(result.diagnostics?.length??0,0);
const {checkNetworkAuth,normalizeNetworkMarkets}=await import('data:text/javascript,'+encodeURIComponent(result.outputText));
const token='abc1'.repeat(16);
const hash=createHash('sha256').update(token).digest('hex');
const now=Date.parse('2026-10-10T16:00:00Z');
const row=(patch={})=>({
 eventId:'game1',sport:'NFL',league:'NFL',home:'Buffalo Bills',away:'Miami Dolphins',
 startTime:'2026-10-10T20:00:00Z',market:'h2h',selection:'Buffalo Bills',
 odds:-120,bookmaker:'DraftKings',provider:'espn-core-odds',
 sourceTimestamp:'2026-10-10T15:59:00Z',pulledAt:'2026-10-10T15:59:20Z',
 priorAgeMin:'1',...patch
});
test('V205 private network token is owner issued, hashed and never a vendor API credential',()=>{
 assert.equal(checkNetworkAuth('Bearer '+token,hash),true);
 assert.equal(checkNetworkAuth('Bearer '+token.slice(0,-1)+'0',hash),false);
 assert.equal(checkNetworkAuth(null,hash),false);
 assert.equal(checkNetworkAuth('Bearer '+token,'garbage'),false);
 assert.equal(checkNetworkAuth('Bearer '+'x'.repeat(64),hash),false);
});
test('V205 preserves independent provider/book count and does not invent multi-book consensus',()=>{
 const one=normalizeNetworkMarkets([row()],now);
 assert.equal(one.coverage.distinctRecentProviders,1);
 assert.equal(one.coverage.distinctRecentBookmakers,1);
 assert.equal(one.coverage.recentSelectionsWithTwoBooks,0);
 assert.equal(one.executionEligible,false);
 assert.equal(one.markets[0].freshness,'RECENT');
 const second=normalizeNetworkMarkets([
  row(),row({bookmaker:'FanDuel',provider:'sports-game-odds',odds:-115})
 ],now);
 assert.equal(second.coverage.distinctRecentProviders,2);
 assert.equal(second.coverage.distinctRecentBookmakers,2);
 assert.equal(second.coverage.recentSelectionsWithTwoBooks,1);
});
test('V205 snapshot age accounts for fetch age AND upstream event age',()=>{
 const stale=normalizeNetworkMarkets([
  row({sourceTimestamp:'2026-10-10T15:43:00Z',pulledAt:'2026-10-10T15:59:59Z'}),
  row({eventId:'game2',sourceTimestamp:null}),
  row({eventId:'game3',sourceTimestamp:'2026-10-10T15:59:50Z',priorAgeMin:'120'})
 ],now);
 assert.equal(stale.coverage.recent,0);
 assert.equal(stale.coverage.missingTimestamp,1);
 assert.deepEqual(stale.markets.map(x=>x.freshness),['STALE','UNVERIFIED','STALE']);
 assert.ok(stale.markets.every(x=>x.executable===false));
});
test('V205 rejects invalid odds and event times, dedupes repeated book/provider snapshots',()=>{
 const rows=normalizeNetworkMarkets([
  row(),row({odds:95}),row({startTime:'2026-10-09T10:00:00Z'}),
  row({eventId:'different',odds:135,provider:'sports-game-odds',bookmaker:'FanDuel'}),
  row({sourceTimestamp:'2026-10-10T15:59:30Z'}),
  row({eventId:'cross',sport:'NCAAF'})
 ],now,2,'NFL');
 assert.equal(rows.coverage.valid,2);
 assert.equal(rows.markets.length,2);
 assert.equal(rows.coverage.malformed,2);
});
test('V205 network routes cannot poll third-party sources or bypass key auth',()=>{
 const markets=read('../src/app/api/network/v1/markets/route.ts');
 const events=read('../src/app/api/network/v1/events/route.ts');
 const docs=read('../EDGEFORCE_V205_SPORTS_NETWORK.md');
 for(const route of [markets,events]){
  assert.match(route,/authorizeNetwork\(request\)/);
  assert.match(route,/from (market_snapshots ms|events e)/);
  assert.doesNotMatch(route,/\bfetch\(/);
  assert.doesNotMatch(route,/fetchLiveScoreMesh|fetchTheOddsApiBoard|ingestOdds/);
 }
 assert.match(markets,/MAX_SCAN/);
 assert.match(events,/limit/);
 assert.match(docs,/EDGEFORCE_NETWORK_TOKEN_SHA256/);
});
