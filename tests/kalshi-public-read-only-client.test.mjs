import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const normalize=data(compile(read('../src/lib/readOnlyScalpMarketBook.ts')));
const ingest=data(compile(read('../src/lib/readOnlyExchangeBookIngestion.ts')).replace(/from ['"]\.\/readOnlyScalpMarketBook['"]/g,"from '"+normalize+"'"));
const adapter=data(compile(read('../src/lib/kalshiPublicOrderBookAdapter.ts')).replace(/from ['"]\.\/readOnlyExchangeBookIngestion['"]/g,"from '"+ingest+"'"));
const client=data(compile(read('../src/lib/kalshiPublicReadOnlyClient.ts')).replace(/from ['"]\.\/kalshiPublicOrderBookAdapter['"]/g,"from '"+adapter+"'"));
const {fetchKalshiPublicYesBook}=await import(client);
const now=Date.parse('2026-11-22T20:00:00Z');
const context=()=>({marketId:'TEST-MARKET',outcomeId:'yes',observedAt:new Date(now).toISOString(),sourceUrl:'https://example.com',marketOpen:true,settlementVerified:true});
test('read-only Kalshi GET converts cents and never sends credentials',async()=>{
 let called=0;
 const fetcher=async(url,options)=>{called++;assert.match(url,/\/orderbook$/);assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,undefined);
  return {ok:true,text:async()=>JSON.stringify({orderbook:{yes:[[40,3]],no:[[57,4]]}})};};
 const result=await fetchKalshiPublicYesBook('TEST-MARKET',context(),now,fetcher);
 assert.equal(called,1);assert.equal(result.status,'ready');assert.equal(result.book.bestBid,.4);
 assert.ok(Math.abs(result.book.bestAsk-.43)<1e-9);
});
test('invalid ticker fails before transport',async()=>{
 let called=false;const r=await fetchKalshiPublicYesBook('../bad',context(),now,async()=>{called=true;});
 assert.equal(r.status,'blocked');assert.equal(called,false);
});
test('HTTP errors and malformed ladders fail closed',async()=>{
 assert.equal((await fetchKalshiPublicYesBook('TEST-MARKET',context(),now,async()=>({ok:false,status:429}))).status,'blocked');
 assert.equal((await fetchKalshiPublicYesBook('TEST-MARKET',context(),now,async()=>({ok:true,text:async()=>JSON.stringify({orderbook:{yes:[[400,1]],no:[[57,2]]}})}))).status,'blocked');
});
