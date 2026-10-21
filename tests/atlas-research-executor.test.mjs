import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=n=>ts.transpileModule(fs.readFileSync(new URL('../worker/'+n+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const policy=uri(compile('atlas-task-scheduling')),lease=uri(compile('atlas-execution-lease'));
const leased=uri(compile('atlas-leased-execution').replaceAll("from './atlas-task-scheduling'","from "+JSON.stringify(policy)).replaceAll("from './atlas-execution-lease'","from "+JSON.stringify(lease)));
const coordinator=uri(compile('atlas-execution-coordinator').replaceAll("from './atlas-leased-execution'","from "+JSON.stringify(leased)));
const bridge=await import(uri(compile('atlas-research-executor').replaceAll("from './atlas-execution-coordinator'","from "+JSON.stringify(coordinator))));
const now=Date.parse('2026-10-20T12:00:00Z'),id='research-bridge-001';
const data=new Map([['atlas-schedule:'+id,{id,state:'QUEUED',attempts:0,createdAt:new Date(now-1000).toISOString(),nextRunAt:new Date(now).toISOString(),expiresAt:new Date(now+60000).toISOString()}],['atlas-research:'+id,{question:'Analyze the scheduled fixtures'}]]);
const storage={transaction:async fn=>fn({get:async key=>data.get(key),put:async(key,value)=>{data.set(key,value);}})};
const args={id,expectedState:'QUEUED',expectedAttempts:0,token:'abcdefghijklmnopqrstuvwxyzABCDEF',now,durationMs:10000,enabled:true,ownerAuthorized:true,providerHealthy:true,clock:()=>now+1000};
test('durable question reaches trusted research callback exactly once',async()=>{
 const questions=[];
 const result=await bridge.executeAtlasScheduledResearch(storage,{...args,research:async q=>{questions.push(q);return {ok:true};}});
 assert.equal(result.ok,true);assert.deepEqual(questions,['Analyze the scheduled fixtures']);
 assert.equal(data.get('atlas-schedule:'+id).state,'COMPLETED');
 const second=await bridge.executeAtlasScheduledResearch(storage,{...args,research:async q=>{questions.push(q);return {ok:true};}});
 assert.equal(second.stage,'claim');assert.equal(questions.length,1);
});
test('disabled bridge never loads or runs research',async()=>{
 let calls=0;
 const result=await bridge.executeAtlasScheduledResearch(storage,{...args,enabled:false,research:async()=>{calls++;return {ok:true};}});
 assert.equal(result.reason,'SCHEDULER_DISABLED');assert.equal(calls,0);
});
