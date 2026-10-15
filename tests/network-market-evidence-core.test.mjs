import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/firstPartySportsNetwork.ts',import.meta.url),'utf8');
const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(result.diagnostics?.length??0,0);
const {checkNetworkAuth,normalizeNetworkMarkets}=await import('data:text/javascript,'+encodeURIComponent(result.outputText));
const now=Date.parse('2026-10-10T16:00:00Z');
const row=(patch={})=>({eventId:'event-1',sport:'NFL',league:'NFL',home:'Home',away:'Away',startTime:'2026-10-10T20:00:00Z',market:'h2h',selection:'Home',odds:-120,bookmaker:'DraftKings',provider:'provider-a',sourceTimestamp:'2026-10-10T15:59:00Z',pulledAt:'2026-10-10T15:59:20Z',priorAgeMin:'1',...patch});
test('network authorization requires a correctly hashed owner token',()=>{
 const token='abc1'.repeat(16);
 const hash=createHash('sha256').update(token).digest('hex');
 assert.equal(checkNetworkAuth('Bearer '+token,hash),true);
 assert.equal(checkNetworkAuth('Bearer '+token.slice(0,-1)+'0',hash),false);
 assert.equal(checkNetworkAuth(null,hash),false);
});
test('observations never claim executable quotes or independent sources with one provider',()=>{
 const result=normalizeNetworkMarkets([row()],now);
 assert.equal(result.executionEligible,false);
 assert.equal(result.coverage.distinctRecentProviders,1);
 assert.equal(result.coverage.recentSelectionsWithTwoBooks,0);
 assert.equal(result.markets[0].executable,false);
});
test('stale and missing source timestamps do not become recent',()=>{
 const result=normalizeNetworkMarkets([row({sourceTimestamp:null}),row({eventId:'event-2',sourceTimestamp:'2026-10-10T15:40:00Z'})],now);
 assert.equal(result.coverage.recent,0);
 assert.deepEqual(result.markets.map(x=>x.freshness),['UNVERIFIED','STALE']);
});
test('reject missing event identities and invalid bookmaker odds',()=>{
 const result=normalizeNetworkMarkets([row({eventId:''}),row({eventId:'event-2',odds:95}),row()],now);
 assert.equal(result.coverage.malformed,2);
 assert.equal(result.coverage.valid,1);
});
