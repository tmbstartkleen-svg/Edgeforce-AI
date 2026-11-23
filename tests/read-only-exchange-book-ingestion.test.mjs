import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const base='data:text/javascript;base64,'+Buffer.from(compile(readFileSync(new URL('../src/lib/readOnlyScalpMarketBook.ts',import.meta.url),'utf8'))).toString('base64');
const js=compile(readFileSync(new URL('../src/lib/readOnlyExchangeBookIngestion.ts',import.meta.url),'utf8')).replace(/from ['"]\.\/readOnlyScalpMarketBook['"]/g,"from '"+base+"'");
const {ingestExchangeBook}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const now=Date.parse('2026-11-22T20:00:00Z');
const book=()=>({venue:'kalshi',marketId:'m1',outcomeId:'yes',observedAt:new Date(now-1000).toISOString(),
 sourceUrl:'https://example.com',marketOpen:true,settlementVerified:true,currency:'USD',
 bids:[{price:.4,quantity:4}],asks:[{price:.42,quantity:6}]});
test('ingests externally verified read-only exchange levels',()=>{
 const r=ingestExchangeBook(book(),now);
 assert.equal(r.status,'ready');assert.equal(r.book.bestBid,.4);
});
test('rejects absent or malformed book levels',()=>{
 assert.equal(ingestExchangeBook({...book(),bids:null},now).status,'blocked');
 assert.equal(ingestExchangeBook({...book(),asks:[{price:.42}]},now).status,'blocked');
});
test('does not promote unverified settlement to ready',()=>{
 assert.equal(ingestExchangeBook({...book(),settlementVerified:false},now).status,'blocked');
});
