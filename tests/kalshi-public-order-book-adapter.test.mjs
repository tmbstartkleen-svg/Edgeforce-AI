import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const normalized=url(compile(read('../src/lib/readOnlyScalpMarketBook.ts')));
const ingest=url(compile(read('../src/lib/readOnlyExchangeBookIngestion.ts')).replace(/from ['"]\.\/readOnlyScalpMarketBook['"]/g,"from '"+normalized+"'"));
const adapter=url(compile(read('../src/lib/kalshiPublicOrderBookAdapter.ts')).replace(/from ['"]\.\/readOnlyExchangeBookIngestion['"]/g,"from '"+ingest+"'"));
const {ingestKalshiYesBook}=await import(adapter);
const now=Date.parse('2026-11-22T20:00:00Z');
const context=()=>({marketId:'KX-TEST',outcomeId:'yes',observedAt:new Date(now-1000).toISOString(),sourceUrl:'https://api.elections.kalshi.com',marketOpen:true,settlementVerified:true});
test('Kalshi NO bids imply complementary YES asks',()=>{
 const r=ingestKalshiYesBook({yes:[[.39,2],[.4,3]],no:[[.57,4],[.56,8]]},context(),now);
 assert.equal(r.status,'ready');assert.equal(r.book.bestBid,.4);
 assert.ok(Math.abs(r.book.bestAsk-.43)<1e-9);assert.equal(r.book.askDepth,4);
});
test('reject malformed ladders and stale or unverified context',()=>{
 assert.equal(ingestKalshiYesBook({yes:[[.4,1]],no:null},context(),now).status,'blocked');
 assert.equal(ingestKalshiYesBook({yes:[[.4,1.5]],no:[[.57,2]]},context(),now).status,'blocked');
 assert.equal(ingestKalshiYesBook({yes:[[.4,1]],no:[[.57,2]]},{...context(),settlementVerified:false},now).status,'blocked');
});
