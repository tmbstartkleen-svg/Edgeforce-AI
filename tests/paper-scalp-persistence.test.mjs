import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const snapshotUrl='data:text/javascript;base64,'+Buffer.from(transpile(readFileSync(new URL('../src/lib/paperScalpSnapshot.ts',import.meta.url),'utf8'))).toString('base64');
const persistence=transpile(readFileSync(new URL('../src/lib/paperScalpPersistence.ts',import.meta.url),'utf8')).replace(/from ['"]\.\/paperScalpSnapshot['"]/g,"from '"+snapshotUrl+"'");
const {persistPaperScalp,restorePaperScalp}=await import('data:text/javascript;base64,'+Buffer.from(persistence).toString('base64'));
const snapshot=(revision=0)=>({version:1,revision,cycle:{marketId:'demo',enabled:true,killSwitch:false,maxPosition:10,maxBuyPrice:.4,targetNetPerContract:.02,buyFeePerContract:.01,sellFeePerContract:.01,nextOrderSequence:1},book:{orders:[],fills:[],owned:0,cashFlow:0}});
function store(){
 const rows=new Map();
 return {read:async id=>rows.get(id)??null,compareAndSwap:async(id,expected,next,payload)=>{
  const current=rows.get(id);
  if((current?.revision??null)!==expected)return false;
  rows.set(id,{revision:next,payload});return true;
 },rows};
}
test('persist and restore validated state',async()=>{
 const s=store();assert.equal((await persistPaperScalp(s,'demo',snapshot(),null)).saved,true);
 const result=await restorePaperScalp(s,'demo');
 assert.equal(result.status,'restored');assert.equal(result.snapshot.revision,0);
});
test('compare-and-swap prevents stale writes',async()=>{
 const s=store();await persistPaperScalp(s,'demo',snapshot(),null);
 assert.equal((await persistPaperScalp(s,'demo',snapshot(1),0)).saved,true);
 assert.equal((await persistPaperScalp(s,'demo',snapshot(1),0)).saved,false);
 assert.equal((await restorePaperScalp(s,'demo')).snapshot.revision,1);
});
test('corrupt payload is rejected during recovery',async()=>{
 const s=store();s.rows.set('demo',{revision:0,payload:'{"invalid":true}'});
 assert.equal((await restorePaperScalp(s,'demo')).status,'invalid');
});
test('storage errors fail closed',async()=>{
 const s={read:async()=>{throw Error('offline')},compareAndSwap:async()=>{throw Error('offline')}};
 assert.equal((await restorePaperScalp(s,'demo')).status,'storage_error');
 assert.equal((await persistPaperScalp(s,'demo',snapshot(),null)).saved,false);
});
