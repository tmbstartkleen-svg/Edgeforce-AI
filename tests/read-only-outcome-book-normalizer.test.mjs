import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/readOnlyOutcomeBookNormalizer.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {normalizeComplementaryBook}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const book=()=>({marketId:'sample',sourceUrl:'https://example.com/market',observedAt:'2026-11-22T12:00:00Z',
 yesBids:[[.41,10],[.44,7]],noBids:[[.51,8],[.54,4]]});
test('best bids imply opposite-side asks with opposing depth',()=>{
 const result=normalizeComplementaryBook(book());
 assert.equal(result.status,'valid');
 assert.deepEqual(result.yesBestBid,{price:.44,contracts:7});
 assert.deepEqual(result.noBestBid,{price:.54,contracts:4});
 assert.deepEqual(result.yesImpliedAsk,{price:.46,contracts:4});
 assert.deepEqual(result.noImpliedAsk,{price:.56,contracts:7});
});
test('malformed levels and missing depth fail closed',()=>{
 const a=book();a.yesBids=[[.45,-2]];
 assert.equal(normalizeComplementaryBook(a).status,'invalid');
 const b=book();b.noBids=[];
 assert.ok(normalizeComplementaryBook(b).reasons.includes('missing_or_invalid_depth'));
});
test('invalid provenance fails closed',()=>{
 const a=book();a.sourceUrl='http://example.com';a.observedAt='not-a-date';
 assert.ok(normalizeComplementaryBook(a).reasons.includes('invalid_provenance'));
});
test('out-of-range prices and fractional contracts fail closed',()=>{
 const a=book();a.yesBids=[[1,5]];
 assert.equal(normalizeComplementaryBook(a).status,'invalid');
 const b=book();b.noBids=[[.6,1.5]];
 assert.equal(normalizeComplementaryBook(b).status,'invalid');
});
