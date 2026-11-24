import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/lib/readOnlyArbQuoteComparison.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {compareComplementaryQuotes}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const now=Date.parse('2026-11-21T20:00:00Z');
const base=(side,venue,price)=>({
 venue,marketId:'m1',eventId:'event-1',outcomeId:'team-a',side,askPrice:price,
 availableContracts:40,observedAt:new Date(now-1000).toISOString(),
 settlementFingerprint:'same-rules-v1',settlementVerified:true,currency:'USD',sourceUrl:'https://example.com/market'
});
const yes=()=>base('yes','kalshi',.42);
const no=()=>base('no','polymarket_us',.52);
test('fresh, settlement-matched complementary asks produce a gross candidate',()=>{
 const r=compareComplementaryQuotes(yes(),no(),now);
 assert.equal(r.status,'candidate');
 assert.ok(Math.abs(r.costPerSet-.94)<1e-10);
 assert.ok(Math.abs(r.grossProfitPerSet-.06)<1e-10);
 assert.equal(r.maxSets,40);
});
test('stale and future-dated quotes fail closed',()=>{
 assert.equal(compareComplementaryQuotes({...yes(),observedAt:new Date(now-60000).toISOString()},no(),now).status,'stale');
 assert.equal(compareComplementaryQuotes({...yes(),observedAt:new Date(now+1000).toISOString()},no(),now).status,'stale');
});
test('mismatched settlement, outcome and missing review fail closed',()=>{
 assert.equal(compareComplementaryQuotes({...yes(),settlementFingerprint:'other'},no(),now).status,'unverified');
 assert.equal(compareComplementaryQuotes({...yes(),outcomeId:'team-b'},no(),now).status,'unverified');
 assert.equal(compareComplementaryQuotes({...yes(),settlementVerified:false},no(),now).status,'unverified');
});
test('zero available depth and invalid quotes are rejected',()=>{
 assert.equal(compareComplementaryQuotes({...yes(),availableContracts:0},no(),now).status,'insufficient_liquidity');
 assert.equal(compareComplementaryQuotes({...yes(),askPrice:1.1},no(),now).status,'invalid');
 assert.equal(compareComplementaryQuotes(yes(),{...no(),side:'yes'},now).status,'invalid');
});
test('gross-negative combinations are not presented as profitable',()=>{
 const r=compareComplementaryQuotes({...yes(),askPrice:.65},{...no(),askPrice:.55},now);
 assert.equal(r.status,'candidate');
 assert.ok(r.grossProfitPerSet<0);
});
