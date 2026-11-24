import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const read=p=>readFileSync(new URL('../src/lib/'+p+'.ts',import.meta.url),'utf8');
const base=data(compile(read('paperScalpOrderEngine')));
const ledger=data(compile(read('paperScalpLedger')).replace(/from ['"]\.\/paperScalpOrderEngine['"]/g,"from '"+base+"'"));
const storage=data(compile(read('paperScalpDurableStorage')).replace(/from ['"]\.\/paperScalpLedger['"]/g,"from '"+ledger+"'"));
const {persistPaperScalpSnapshot}=await import(storage);
const initial=()=>({schemaVersion:1,marketId:'m1',revision:0,book:{orders:[],fills:[],owned:0,cashFlow:0},cycle:{marketId:'m1'},processedEventIds:[]});
test('atomically saves one revision and rejects replay',async()=>{
 let stored=initial();
 const adapter={read:async()=>structuredClone(stored),compareAndSwap:async(_id,rev,next)=>{
  if(stored.revision!==rev)return false;stored=structuredClone(next);return true;
 }};
 const prev=initial(),next={...initial(),revision:1,processedEventIds:['evt1']};
 assert.equal((await persistPaperScalpSnapshot(adapter,prev,next)).status,'saved');
 assert.equal(stored.revision,1);
 assert.equal((await persistPaperScalpSnapshot(adapter,prev,next)).status,'conflict');
});
test('rejects skipped revision, event history rewrite and storage outage',async()=>{
 const prev=initial(),adapter={read:async()=>prev,compareAndSwap:async()=>true};
 assert.equal((await persistPaperScalpSnapshot(adapter,prev,{...prev,revision:2,processedEventIds:['evt1']})).status,'blocked');
 assert.equal((await persistPaperScalpSnapshot(adapter,prev,{...prev,revision:1,processedEventIds:[]})).status,'blocked');
 const unavailable={read:async()=>{throw Error('offline');},compareAndSwap:async()=>true};
 assert.equal((await persistPaperScalpSnapshot(unavailable,prev,{...prev,revision:1,processedEventIds:['evt1']})).status,'blocked');
});
