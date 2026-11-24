import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const src=readFileSync(new URL('../src/lib/readOnlyScalpMarketBook.ts',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {normalizeReadOnlyMarketBook}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const now=Date.parse('2026-11-22T20:00:00Z');
const sample=()=>({venue:'kalshi',marketId:'m1',outcomeId:'yes',observedAt:new Date(now-1000).toISOString(),
 sourceUrl:'https://example.com/market',currency:'USD',marketOpen:true,settlementVerified:true,
 bids:[{price:.4,quantity:3},{price:.39,quantity:8},{price:.4,quantity:2}],
 asks:[{price:.42,quantity:5},{price:.43,quantity:10}]});
test('normalizes best bid/ask and aggregate top-of-book depth',()=>{
 const r=normalizeReadOnlyMarketBook(sample(),now);
 assert.equal(r.status,'verified_read_only');
 assert.equal(r.bestBid,.4);assert.equal(r.bestAsk,.42);
 assert.equal(r.bidDepth,5);assert.equal(r.askDepth,5);
});
test('rejects stale, crossed, empty, and unverified quotes',()=>{
 assert.equal(normalizeReadOnlyMarketBook({...sample(),observedAt:new Date(now-90000).toISOString()},now).status,'blocked');
 assert.equal(normalizeReadOnlyMarketBook({...sample(),bids:[{price:.5,quantity:1}]},now).status,'blocked');
 assert.equal(normalizeReadOnlyMarketBook({...sample(),asks:[]},now).status,'blocked');
 assert.equal(normalizeReadOnlyMarketBook({...sample(),settlementVerified:false},now).status,'blocked');
});
test('rejects fabricated or invalid depth and price',()=>{
 assert.equal(normalizeReadOnlyMarketBook({...sample(),bids:[{price:.4,quantity:1.5}]},now).status,'blocked');
 assert.equal(normalizeReadOnlyMarketBook({...sample(),asks:[{price:1.2,quantity:1}]},now).status,'blocked');
});
