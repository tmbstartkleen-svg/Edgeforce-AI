import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const auth=uri(ts.transpileModule(read('src/lib/firstPartySportsNetwork.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const mockIngest=uri('export async function ingestOdds(options){globalThis.__edgeforceCalls.push(options);return {mode:"live",source:"live",providerId:"the-odds-api",providerName:"The Odds API",targetBook:"DraftKings",degraded:false,rawCount:1,quality:{grade:"USABLE",qualityScore:.9,rowCount:2},providerPanel:[],warnings:[],attempts:[],markets:[],panelMarkets:[{sport:"basketball_nba",league:"NBA",event:"Away @ Home",selection:"Home",market:"h2h",odds:-115,sourceBook:"DraftKings",sourceProviderId:"the-odds-api",startTime:new Date(Date.now()+3600000).toISOString(),sourceAgeMin:1}]}}');
const source=ts.transpileModule(read('src/app/api/markets/route.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
 .replace("from '@/lib/providers/ingest'","from "+JSON.stringify(mockIngest))
 .replace("from '@/lib/firstPartySportsNetwork'","from "+JSON.stringify(auth));
const {GET}=await import(uri(source));
const secret='0123456789abcdef'.repeat(4);
const request=(url,token)=>new Request(url,{headers:token?{authorization:'Bearer '+token}:{}});
test('unauthorized forceLive request is rejected before provider invocation',async()=>{
 globalThis.__edgeforceCalls=[];
 const response=await GET(request('https://edgeforce.invalid/api/markets?forceLive=1'));
 assert.equal(response.status,401);
 assert.equal(globalThis.__edgeforceCalls.length,0);
});
test('owner-authorized forceLive request uses DraftKings scan and explicitly disables persistence',async()=>{
 globalThis.__edgeforceCalls=[];
 const response=await GET(request('https://edgeforce.invalid/api/markets?forceLive=1',secret));
 const body=await response.json();
 assert.equal(response.status,200);
 assert.deepEqual(globalThis.__edgeforceCalls,[{forceLive:true,persist:false}]);
 assert.equal(body.sportsbookQuoteCount,1);
 assert.equal(body.draftKingsQuoteCount,1);
 assert.equal(body.sportsbookQuotes[0].sourceBook,'DraftKings');
 assert.equal(body.providerRequests,undefined);
 assert.equal(body.executablePriceVerified,false);
});
test('ordinary market route retains normal cache and persistence behavior',async()=>{
 globalThis.__edgeforceCalls=[];
 const response=await GET(request('https://edgeforce.invalid/api/markets'));
 assert.equal(response.status,200);
 assert.deepEqual(globalThis.__edgeforceCalls,[{forceLive:false,persist:true}]);
});
