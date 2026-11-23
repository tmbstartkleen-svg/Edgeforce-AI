import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const norm=data(compile(read('../src/lib/readOnlyScalpMarketBook.ts')));
const ingest=data(compile(read('../src/lib/readOnlyExchangeBookIngestion.ts')).replace(/from ['"]\.\/readOnlyScalpMarketBook['"]/g,"from '"+norm+"'"));
const adapter=data(compile(read('../src/lib/polymarketUSReadOnlyBookAdapter.ts')).replace(/from ['"]\.\/readOnlyExchangeBookIngestion['"]/g,"from '"+ingest+"'"));
const {ingestPolymarketUSBook}=await import(adapter);
const now=Date.parse('2026-11-22T20:00:00Z');
const sample=()=>({marketId:'p1',outcomeId:'yes',observedAt:new Date(now-1000).toISOString(),
 sourceUrl:'https://example.com',marketOpen:true,settlementVerified:true,
 bids:[{price:.45,quantity:5}],asks:[{price:.47,quantity:8}]});
test('verified read-only Polymarket US snapshot normalizes depth',()=>{
 const r=ingestPolymarketUSBook(sample(),now);
 assert.equal(r.status,'ready');assert.equal(r.book.bestBid,.45);assert.equal(r.book.askDepth,8);
});
test('rejects unverified, stale, crossed and malformed books',()=>{
 assert.equal(ingestPolymarketUSBook({...sample(),settlementVerified:false},now).status,'blocked');
 assert.equal(ingestPolymarketUSBook({...sample(),observedAt:new Date(now-90000).toISOString()},now).status,'blocked');
 assert.equal(ingestPolymarketUSBook({...sample(),bids:[{price:.55,quantity:5}]},now).status,'blocked');
 assert.equal(ingestPolymarketUSBook({...sample(),asks:[{price:'0.47',quantity:8}]},now).status,'blocked');
});
