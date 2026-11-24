import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source=fs.readFileSync(new URL('../worker/atlas-autonomous-audit.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const url='data:text/javascript;base64,'+Buffer.from(js).toString('base64');
const {AtlasAuditController}=await import(url);

class Store{
 rows=new Map();
 alarmTime=null;
 async get(key){return this.rows.get(key);}
 async put(key,value){this.rows.set(key,value);}
 async setAlarm(at){this.alarmTime=at;}
 async deleteAlarm(){this.alarmTime=null;}
}

test('new audit rooms are disabled; only explicit Founder action schedules recurring checks',async()=>{
 const storage=new Store();
 const audited=new AtlasAuditController(storage,{});
 assert.equal((await audited.snapshot()).config.enabled,false);
 assert.equal(storage.alarmTime,null);
 const config=await audited.configure(true,60);
 assert.equal(config.enabled,true);
 assert.ok(storage.alarmTime>Date.now());
 await audited.configure(false,60);
 assert.equal((await audited.snapshot()).config.enabled,false);
 assert.equal(storage.alarmTime,null);
});

test('manual read-only audit records observed source health without provider API calls',async()=>{
 const storage=new Store();
 const audited=new AtlasAuditController(storage,{INTELLIGENCE_DB:{
  prepare(query){
   assert.match(query,/SELECT source_id AS source/);
   assert.doesNotMatch(query,/payload/);
   return {all:async()=>({results:[{source:'test',latest:new Date().toISOString(),count:3}]})};
  }
 }});
 const queued=await audited.enqueue();
 assert.equal(queued.status,'QUEUED');
 assert.ok(storage.alarmTime);
 const data=await storage.get('atlas.audit.jobs.v1');
 data[0].dueAt=Date.now()-1;
 await storage.put('atlas.audit.jobs.v1',data);
 await audited.executeAlarm();
 const state=await audited.snapshot();
 assert.equal(state.jobs[0].status,'COMPLETED');
 assert.equal(state.jobs[0].attempts,1);
 assert.equal(state.alerts.length,0);
});

test('read failures retry twice, then fail with a private alert; disabling cancels pending jobs',async()=>{
 const storage=new Store();
 const audited=new AtlasAuditController(storage,{});
 await audited.enqueue();
 for(let attempt=0;attempt<3;attempt++){
  const jobs=await storage.get('atlas.audit.jobs.v1');
  jobs[0].dueAt=Date.now()-1;
  await storage.put('atlas.audit.jobs.v1',jobs);
  await audited.executeAlarm();
 }
 const state=await audited.snapshot();
 assert.equal(state.jobs[0].status,'FAILED');
 assert.equal(state.jobs[0].attempts,3);
 assert.ok(state.alerts.some(alert=>alert.kind==='FAILED'));
 const next=await audited.enqueue();
 assert.equal(next.status,'QUEUED');
 await audited.configure(false,60);
 const after=await audited.snapshot();
 assert.equal(after.jobs.at(-1).status,'CANCELLED');
 assert.equal(storage.alarmTime,null);
});
