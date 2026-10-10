import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/providers/publicSportsContext.ts',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const markets=Array.from({length:30},(_,i)=>({sport:'NFL',home:'Home '+i,away:'Away '+i,startTime:new Date(Date.UTC(2026,9,10+i)).toISOString()}));
test('context discovery caps actual fetches and reports partial coverage',async()=>{
 const original=globalThis.fetch,enabled=process.env.PUBLIC_CONTEXT_ENABLED,max=process.env.PUBLIC_CONTEXT_MAX_EVENTS;
 process.env.PUBLIC_CONTEXT_ENABLED='true';process.env.PUBLIC_CONTEXT_MAX_EVENTS='30';let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({events:[]});};
 try{
  const runtime=await import('data:text/javascript,'+encodeURIComponent(compiled+'\n// budget fixture'));
  const result=await runtime.fetchPublicSportsContext(markets);
  assert.equal(calls,12);assert.equal(result.diagnostics.actualRequests,12);assert.equal(result.diagnostics.requestLimit,12);assert.match(result.diagnostics.warnings.join(' '),/partial/);
 }finally{globalThis.fetch=original;if(enabled===undefined)delete process.env.PUBLIC_CONTEXT_ENABLED;else process.env.PUBLIC_CONTEXT_ENABLED=enabled;if(max===undefined)delete process.env.PUBLIC_CONTEXT_MAX_EVENTS;else process.env.PUBLIC_CONTEXT_MAX_EVENTS=max;}
});
test('context deadline prevents further outbound requests',async()=>{
 const original=globalThis.fetch,originalNow=Date.now,enabled=process.env.PUBLIC_CONTEXT_ENABLED;let clock=1000,calls=0;
 process.env.PUBLIC_CONTEXT_ENABLED='true';Date.now=()=>clock;
 globalThis.fetch=async()=>{calls++;clock+=7000;return Response.json({events:[]});};
 try{
  const runtime=await import('data:text/javascript,'+encodeURIComponent(compiled+'\n// deadline fixture'));
  const result=await runtime.fetchPublicSportsContext(markets);
  assert.equal(calls,1);assert.equal(result.diagnostics.actualRequests,1);assert.match(result.diagnostics.warnings.join(' '),/deadline/);
 }finally{globalThis.fetch=original;Date.now=originalNow;if(enabled===undefined)delete process.env.PUBLIC_CONTEXT_ENABLED;else process.env.PUBLIC_CONTEXT_ENABLED=enabled;}
});
