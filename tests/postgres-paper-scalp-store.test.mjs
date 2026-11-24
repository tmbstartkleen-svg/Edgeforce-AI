import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/postgresPaperScalpStore.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createPostgresPaperScalpStore}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('SQL adapter uses parameterized insert and revision-checked update',async()=>{
 const calls=[];
 const client={query:async(sql,params)=>{calls.push({sql,params});return {rows:[],rowCount:1}}};
 const store=createPostgresPaperScalpStore(client);
 assert.equal(await store.compareAndSwap('event:market',null,0,'{}'),true);
 assert.equal(await store.compareAndSwap('event:market',0,1,'{"revision":1}'),true);
 assert.match(calls[0].sql,/ON CONFLICT.*DO NOTHING/);
 assert.match(calls[1].sql,/WHERE market_id = \$1 AND revision = \$2/);
 assert.deepEqual(calls[1].params,['event:market',0,1,'{"revision":1}']);
});
test('SQL adapter detects failed compare-and-swap',async()=>{
 const store=createPostgresPaperScalpStore({query:async()=>({rows:[],rowCount:0})});
 assert.equal(await store.compareAndSwap('m',2,3,'{}'),false);
});
test('SQL adapter rejects invalid revision transitions without query',async()=>{
 let called=false;
 const store=createPostgresPaperScalpStore({query:async()=>{called=true;return {rows:[],rowCount:1}}});
 await assert.rejects(()=>store.compareAndSwap('m',2,4,'{}'));
 assert.equal(called,false);
});
test('SQL adapter reads revision safely',async()=>{
 const store=createPostgresPaperScalpStore({query:async()=>({rows:[{revision:'3',payload:'{}'}],rowCount:1})});
 assert.deepEqual(await store.read('m'),{revision:3,payload:'{}'});
});
