import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

// Execute the actual route with its real pure analysis modules and synthetic input.
const source=fs.readFileSync('src/app/api/operations/market-opportunity-scan/route.ts','utf8')
 .replaceAll('@/lib/intelligence-core/',pathToFileURL(process.cwd()+'/src/lib/intelligence-core/').href);
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {POST}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const secret='fixture-only-operator-secret-1234567890';
const request=(body,auth=secret,headers={})=>new Request('https://example.test/api/operations/market-opportunity-scan',{
 method:'POST',headers:{authorization:'Bearer '+auth,'content-type':'application/json',...headers},
 body:typeof body==='string'?body:JSON.stringify(body)});

test('read-only research route validates authorization, rejects oversized streams, and never activates providers',async t=>{
 const original=process.env.CRON_SECRET;
 t.after(()=>{if(original===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=original});
 process.env.CRON_SECRET='short';
 assert.equal((await POST(request({quotes:[]}))).status,503);
 process.env.CRON_SECRET=secret;
 assert.equal((await POST(request({quotes:[]},'wrong'))).status,401);
 for(const body of ['{invalid',[],{quotes:[],playerResearch:{}},{quotes:[],forecasts:{}}])
  assert.equal((await POST(request(body))).status,400);
 assert.equal((await POST(request('{}',secret,{'content-length':String(4*1024*1024+1)}))).status,413);
 assert.equal((await POST(request(' '.repeat(4*1024*1024+1)))).status,413);
 const response=await POST(request({quotes:[],forecasts:[],playerResearch:[],providerActivationEnabled:true,
  sourceAuthenticityCertified:true,productionBetRecommendationAuthorized:true}));
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 const data=await response.json();
 assert.equal(data.research.schemaVersion,'sports-research-v1');
 assert.equal(data.research.providerActivationEnabled,false);
 assert.equal(data.sourceAuthenticityCertified,false);
 assert.equal(data.productionBetRecommendationAuthorized,false);
 assert.equal(data.ordersPlaced+data.externalApiRequests+data.databaseWrites,0);
});
