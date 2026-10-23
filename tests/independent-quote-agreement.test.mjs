import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const raw=fs.readFileSync(new URL('../src/lib/independent-quote-agreement.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {analyzeIndependentQuoteAgreement}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const now=Date.parse('2026-10-23T19:00:00Z');
const quote=(upstreamId,americanOdds=-117,other={})=>({upstreamId,bookmaker:'DraftKings',
 eventId:'nba-abc',marketType:'h2h',outcomeId:'home',americanOdds,
 observedAt:new Date(now-30000).toISOString(),startsAt:new Date(now+3600000).toISOString(),...other});
test('independent source identities corroborate same bookmaker and outcome within tolerance',()=>{
 const r=analyzeIndependentQuoteAgreement([quote('feed-A'),quote('feed-B',-118)],now);
 assert.equal(r.comparedMarkets,1);assert.equal(r.corroboratedMarkets,1);
 assert.equal(r.comparisons[0].independentUpstreams,2);
 assert.equal(r.releaseCertified,false);
});
test('one upstream, even when repeated, is not independent',()=>{
 const r=analyzeIndependentQuoteAgreement([quote('feed-A'),quote('feed-A',-117)],now);
 assert.equal(r.unmatchedMarkets,1);assert.equal(r.hasCorroboratedQuotes,false);
});
test('same operator with different bookmaker outcomes cannot stand in for independent books',()=>{
 const r=analyzeIndependentQuoteAgreement([quote('feed-A'),quote('feed-B',-117,{bookmaker:'FanDuel'})],now);
 assert.equal(r.comparedMarkets,0);assert.equal(r.unmatchedMarkets,2);
});
test('independent providers with materially different prices flag divergence',()=>{
 const r=analyzeIndependentQuoteAgreement([quote('feed-A',-115),quote('feed-B',+150)],now);
 assert.equal(r.divergentMarkets,1);assert.equal(r.corroboratedMarkets,0);
});
test('expired price, missing market line and provisional player ID are rejected',()=>{
 const stale=quote('feed-A',-117,{observedAt:new Date(now-3600000).toISOString()});
 const line=quote('feed-A',-117,{marketType:'totals'});
 const provisional=quote('feed-A',-117,{marketType:'player_points',line:'20.5',playerId:'name:unknown'});
 const r=analyzeIndependentQuoteAgreement([stale,line,provisional],now);
 assert.equal(r.rejected.STALE_OR_STARTED,1);
 assert.equal(r.rejected.MISSING_LINE,1);
 assert.equal(r.rejected.PROVISIONAL_PLAYER,1);
});
test('market identity prevents conflating alternate lines and players',()=>{
 const r=analyzeIndependentQuoteAgreement([
 quote('A',-110,{marketType:'player_points',line:'20.5',playerId:'athlete-1'}),
 quote('B',-110,{marketType:'player_points',line:'21.5',playerId:'athlete-1'})
 ],now);
 assert.equal(r.comparedMarkets,0);
 assert.equal(r.unmatchedMarkets,2);
});
test('bounded and pure analysis',()=>{
 assert.throws(()=>analyzeIndependentQuoteAgreement([],now,11),/INVALID_SOURCE_AGREEMENT_INPUT/);
 assert.doesNotMatch(raw,/fetch\(|INSERT INTO|Math\.random/);
});
