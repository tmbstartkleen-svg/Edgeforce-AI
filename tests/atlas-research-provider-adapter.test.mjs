import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const src=fs.readFileSync(new URL('../worker/atlas-research-provider-adapter.ts',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createAtlasResearchProviderAdapter}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('private adapter forwards bounded question to existing Director path',async()=>{
 let forwarded;
 const execute=createAtlasResearchProviderAdapter(async req=>{forwarded=req;return Response.json({ok:true,question:'Soccer schedule',persisted:true,durable:true});},'https://edgeforce.example');
 assert.deepEqual(await execute('Soccer schedule'),{ok:true});
 assert.equal(new URL(forwarded.url).pathname,'/api/network/director');
 assert.deepEqual(await forwarded.json(),{question:'Soccer schedule'});
});
test('adapter rejects provider mismatches and failures',async()=>{
 const mismatch=createAtlasResearchProviderAdapter(async()=>Response.json({ok:true,question:'Different'}),'https://edgeforce.example');
 assert.equal((await mismatch('Soccer schedule')).reason,'INVALID_DIRECTOR_REPORT');
 const failed=createAtlasResearchProviderAdapter(async()=>Response.json({ok:false},{status:503}),'https://edgeforce.example');
 assert.equal((await failed('Soccer schedule')).reason,'RESEARCH_UPSTREAM_FAILED');
});

test('adapter rejects insecure origins without making a provider request',async()=>{
 for(const origin of ['http://edgeforce.example','https://user:pass@edgeforce.example','https://edgeforce.example/other']){
  let requests=0;
  const adapter=createAtlasResearchProviderAdapter(async()=>{requests++;return Response.json({ok:true});},origin);
  assert.equal((await adapter('Soccer schedule')).reason,'INVALID_ORIGIN');
  assert.equal(requests,0);
 }
});

test('scheduled Director cannot report success without durable journal confirmation',async()=>{
 for(const report of [
  {ok:true,question:'Soccer schedule'},
  {ok:true,question:'Soccer schedule',persisted:true},
  {ok:true,question:'Soccer schedule',durable:true},
  {ok:true,question:'Soccer schedule',persisted:false,durable:true}
 ]){
  const adapter=createAtlasResearchProviderAdapter(async()=>Response.json(report),'https://edgeforce.example');
  assert.deepEqual(await adapter('Soccer schedule'),{ok:false,reason:'INVALID_DIRECTOR_REPORT'});
 }
});
