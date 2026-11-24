import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const norm=data(compile(read('../src/lib/readOnlyScalpMarketBook.ts')));
const ingest=data(compile(read('../src/lib/readOnlyExchangeBookIngestion.ts')).replace(/from ['"]\.\/readOnlyScalpMarketBook['"]/g,"from '"+norm+"'"));
const adapter=data(compile(read('../src/lib/kalshiPublicOrderBookAdapter.ts')).replace(/from ['"]\.\/readOnlyExchangeBookIngestion['"]/g,"from '"+ingest+"'"));
const client=data(compile(read('../src/lib/kalshiPublicReadOnlyClient.ts')).replace(/from ['"]\.\/kalshiPublicOrderBookAdapter['"]/g,"from '"+adapter+"'"));
const discovery=data(compile(read('../src/lib/kalshiPublicMarketDiscovery.ts')));
const scannerJs=compile(read('../src/lib/kalshiReadOnlyPageScanner.ts'))
 .replace(/from ['"]\.\/kalshiPublicMarketDiscovery['"]/g,"from '"+discovery+"'")
 .replace(/from ['"]\.\/kalshiPublicReadOnlyClient['"]/g,"from '"+client+"'");
const {scanKalshiPublicPage}=await import(data(scannerJs));
const now=Date.parse('2026-11-22T20:00:00Z');
const options=()=>({limit:10,maxBooks:10,maxQuoteAgeMs:30000,verifiedTickers:new Set(['TEST-1'])});
const fetcher=async url=>({ok:true,text:async()=>JSON.stringify(url.endsWith('/orderbook')?
 {orderbook:{yes:[[40,3]],no:[[57,4]]}}:
 {markets:[{ticker:'TEST-1',title:'One',status:'active'},{ticker:'TEST-2',title:'Two',status:'active'}]})});
test('scans only settlement-reviewed markets and never assumes verification',async()=>{
 const r=await scanKalshiPublicPage(fetcher,now,options());
 assert.equal(r.status,'completed');assert.equal(r.scanned,2);
 assert.equal(r.books.length,1);assert.equal(r.books[0].marketId,'TEST-1');
 assert.deepEqual(r.blockedMarkets[0].reasons,['settlement_review_required']);
});
test('empty verification list results in no quote requests',async()=>{
 let calls=0;const r=await scanKalshiPublicPage(async url=>{calls++;return fetcher(url);},now,{...options(),verifiedTickers:new Set()});
 assert.equal(calls,1);assert.equal(r.books.length,0);
});
