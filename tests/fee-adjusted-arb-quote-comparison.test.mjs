import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url='data:text/javascript;base64,'+Buffer.from(transpile(load('../src/lib/readOnlyArbQuoteComparison.ts'))).toString('base64');
const feeJs=transpile(load('../src/lib/feeAdjustedArbQuoteComparison.ts')).replace(/from ['"]\.\/readOnlyArbQuoteComparison['"]/g,"from '"+url+"'");
const {evaluateFeeAdjustedPair}=await import('data:text/javascript;base64,'+Buffer.from(feeJs).toString('base64'));
const now=Date.parse('2026-11-21T20:00:00Z');
const quote=(side,venue,price)=>({side,venue,askPrice:price,availableContracts:40,
 marketId:'m1',eventId:'e1',outcomeId:'o1',settlementFingerprint:'verified-rule-1',
 settlementVerified:true,observedAt:new Date(now-1000).toISOString(),currency:'USD',
 sourceUrl:'https://example.com'});
test('six-cent gross less two-cent fees yields four-cent net',()=>{
 const r=evaluateFeeAdjustedPair(quote('yes','kalshi',.42),quote('no','polymarket_us',.52),now,.01,.01);
 assert.equal(r.status,'paper_candidate');
 assert.ok(Math.abs(r.netPerSet-.04)<1e-10);
 assert.ok(Math.abs(r.netAtDepth-1.6)<1e-10);
});
test('fees erase apparent opportunity',()=>{
 const r=evaluateFeeAdjustedPair(quote('yes','kalshi',.42),quote('no','polymarket_us',.52),now,.04,.04);
 assert.equal(r.status,'not_profitable');assert.ok(r.netPerSet<0);
});
test('invalid fees, stale quotes and settlement mismatches fail closed',()=>{
 const a=quote('yes','kalshi',.42),b=quote('no','polymarket_us',.52);
 assert.equal(evaluateFeeAdjustedPair(a,b,now,-.01,0).status,'invalid');
 assert.equal(evaluateFeeAdjustedPair({...a,observedAt:new Date(now-90000).toISOString()},b,now,0,0).status,'stale');
 assert.equal(evaluateFeeAdjustedPair({...a,settlementVerified:false},b,now,0,0).status,'unverified');
});
