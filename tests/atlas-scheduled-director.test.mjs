import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=n=>ts.transpileModule(fs.readFileSync(new URL('../worker/'+n+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const p=uri(compile('atlas-task-scheduling')),l=uri(compile('atlas-execution-lease'));
const leased=uri(compile('atlas-leased-execution').replaceAll("from './atlas-task-scheduling'","from "+JSON.stringify(p)).replaceAll("from './atlas-execution-lease'","from "+JSON.stringify(l)));
const coord=uri(compile('atlas-execution-coordinator').replaceAll("from './atlas-leased-execution'","from "+JSON.stringify(leased)));
const bridge=uri(compile('atlas-research-executor').replaceAll("from './atlas-execution-coordinator'","from "+JSON.stringify(coord)));
const adapter=uri(compile('atlas-research-provider-adapter'));
const composed=compile('atlas-scheduled-director').replaceAll("from './atlas-research-executor'","from "+JSON.stringify(bridge)).replaceAll("from './atlas-research-provider-adapter'","from "+JSON.stringify(adapter));
const {runAtlasScheduledDirector}=await import(uri(composed));
const now=Date.parse('2026-10-20T12:00:00Z'),id='scheduled-director-001';
function fixture(){const rows=new Map([['atlas-schedule:'+id,{id,state:'QUEUED',attempts:0,createdAt:new Date(now-1000).toISOString(),nextRunAt:new Date(now).toISOString(),expiresAt:new Date(now+60000).toISOString()}],['atlas-research:'+id,{question:'Review soccer matches'}]]);return {rows,storage:{transaction:async fn=>fn({get:async k=>rows.get(k),put:async(k,v)=>{rows.set(k,v);}})}};}
const args={id,expectedState:'QUEUED',expectedAttempts:0,token:'abcdefghijklmnopqrstuvwxyzABCDEF',now,durationMs:10000,enabled:true,ownerAuthorized:true,providerHealthy:true,clock:()=>now+1000,origin:'https://edgeforce.example'};
test('private composition retrieves task question, calls Director and fences completion',async()=>{
 const {rows,storage}=fixture();let requests=0;
 const forward=async req=>{requests++;assert.equal(new URL(req.url).pathname,'/api/network/director');assert.deepEqual(await req.json(),{question:'Review soccer matches'});return Response.json({ok:true,question:'Review soccer matches',persisted:true,durable:true});};
 assert.equal((await runAtlasScheduledDirector(storage,{...args,forward})).ok,true);
 assert.equal(rows.get('atlas-schedule:'+id).state,'COMPLETED');
 assert.equal((await runAtlasScheduledDirector(storage,{...args,forward})).stage,'claim');
 assert.equal(requests,1);
});
test('disabled scheduler cannot touch provider or claim task',async()=>{
 const {rows,storage}=fixture();let requests=0;
 const response=await runAtlasScheduledDirector(storage,{...args,enabled:false,forward:async()=>{requests++;return Response.json({ok:true});}});
 assert.equal(response.reason,'SCHEDULER_DISABLED');assert.equal(requests,0);
 assert.equal(rows.get('atlas-schedule:'+id).state,'QUEUED');
});

test('invalid Director origin cannot claim or invoke upstream research',async()=>{
 for(const origin of ['http://edgeforce.example','https://user:pass@edgeforce.example','not a URL']){
  const {rows,storage}=fixture();let called=0;
  const response=await runAtlasScheduledDirector(storage,{...args,origin,forward:async()=>{called++;return Response.json({ok:true});}});
  assert.equal(response.reason,'INVALID_DIRECTOR_ORIGIN');
  assert.equal(called,0);assert.equal(rows.get('atlas-schedule:'+id).state,'QUEUED');
 }
});
