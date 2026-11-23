import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/kalshiPublicMarketDiscovery.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {discoverKalshiPublicMarkets}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('discovers public open markets with pagination and GET-only transport',async()=>{
 let called=0;
 const fetcher=async(url,options)=>{called++;assert.equal(options.method,'GET');assert.match(url,/status=open/);
  return {ok:true,text:async()=>JSON.stringify({markets:[{ticker:'KX-TEST',title:'Example',status:'active',close_time:'2026-12-01T00:00:00Z'}],cursor:'next123'})};};
 const r=await discoverKalshiPublicMarkets(fetcher,25);
 assert.equal(called,1);assert.equal(r.status,'ready');assert.equal(r.markets[0].ticker,'KX-TEST');assert.equal(r.nextCursor,'next123');
});
test('invalid cursor prevents network access',async()=>{
 let called=false;
 const r=await discoverKalshiPublicMarkets(async()=>{called=true;},100,'../unsafe');
 assert.equal(r.status,'blocked');assert.equal(called,false);
});
test('bad response and non-open markets fail closed',async()=>{
 assert.equal((await discoverKalshiPublicMarkets(async()=>({ok:false,status:429}))).status,'blocked');
 assert.equal((await discoverKalshiPublicMarkets(async()=>({ok:true,text:async()=>JSON.stringify({markets:[{ticker:'X',title:'X',status:'closed'}]})}))).status,'blocked');
});
