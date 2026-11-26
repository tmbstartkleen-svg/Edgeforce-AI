import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const read=p=>readFileSync(new URL('../src/lib/'+p+'.ts',import.meta.url),'utf8');
const mod=(name,dependencies={})=>{
 let js=compile(read(name));
 for(const [dep,url] of Object.entries(dependencies))js=js.replace(new RegExp("from ['\"]\\./"+dep+"['\"]","g"),"from '"+url+"'");
 return data(js);
};
const paper=mod('paperScalpOrderEngine');
const cycle=mod('paperAutomatedScalpCycle',{paperScalpOrderEngine:paper});
const rank=mod('crossVenuePaperScalpRanking');
const ledger=mod('paperScalpLedger',{paperScalpOrderEngine:paper});
const dispatcher=mod('paperScalpQuoteDispatcher',{paperAutomatedScalpCycle:cycle,crossVenuePaperScalpRanking:rank});
const bridge=mod('paperScalpLedgerDispatcher',{paperScalpLedger:ledger,paperScalpQuoteDispatcher:dispatcher});
const {dispatchPaperScalpWithLedger}=await import(bridge);
const state=()=>({schemaVersion:1,marketId:'m1',revision:0,book:{orders:[],fills:[],owned:0,cashFlow:0},
 cycle:{marketId:'m1',enabled:true,killSwitch:false,maxPosition:5,maxBuyPrice:.42,targetNetPerContract:.02,buyFeePerContract:.005,sellFeePerContract:.005,nextOrderSequence:1},processedEventIds:[]});
const quote=()=>({venue:'kalshi',marketId:'m1',outcomeId:'yes',status:'verified_read_only',bestBid:.4,bestAsk:.45,bidDepth:5,askDepth:5,ageMs:100});
const settings=()=>({maxSpread:.1,minimumNetPerContract:.01,buyFeePerContract:.005,sellFeePerContract:.005,maxContracts:5,tickSize:.01});
test('valid recovery snapshot dispatches revisioned paper order',()=>{
 const r=dispatchPaperScalpWithLedger(state(),0,[quote()],settings(),Date.now());
 assert.equal(r.status,'paper_order_created');assert.equal(r.state.revision,1);
 assert.equal(r.state.book.orders.length,1);
 assert.equal(dispatchPaperScalpWithLedger(r.state,1,[quote()],settings(),Date.now()).status,'waiting');
});
test('stale revision and tampered inventory prevent dispatch',()=>{
 assert.equal(dispatchPaperScalpWithLedger(state(),1,[quote()],settings(),Date.now()).reason,'revision_conflict');
 const corrupt=state();corrupt.book.owned=2;
 assert.equal(dispatchPaperScalpWithLedger(corrupt,0,[quote()],settings(),Date.now()).reason,'invalid_recovery_snapshot');
});

const durable=mod('paperScalpDurableStorage',{paperScalpLedger:ledger});
const tick=mod('persistentPaperScalpTick',{paperScalpLedger:ledger,paperScalpLedgerDispatcher:bridge,paperScalpDurableStorage:durable});
const {runPersistentPaperTick}=await import(tick);
const memoryStorage=()=>{
 let saved=state();
 return {async read(){return structuredClone(saved);},
 async compareAndSwap(id,revision,next){
  if(saved.marketId!==id||saved.revision!==revision)return false;
  saved=structuredClone(next);return true;
 }};
};
test('concurrent persistent ticks acknowledge only one order and recover without duplication',async()=>{
 const storage=memoryStorage();
 const run=()=>runPersistentPaperTick(storage,'m1',[quote()],settings(),Date.now());
 const results=await Promise.all([run(),run()]);
 assert.equal(results.filter(r=>r.status==='paper_order_created').length,1);
 assert.equal(results.filter(r=>r.orderId!==null).length,1);
 const recovered=await storage.read('m1');
 assert.equal(recovered.revision,1);
 assert.equal(recovered.book.orders.length,1);
 assert.equal((await run()).status,'waiting');
});
test('persistent tick never acknowledges failed writes or unavailable storage',async()=>{
 for(const storage of [
  {async read(){throw Error('offline');},async compareAndSwap(){return true;}},
  {async read(){return state();},async compareAndSwap(){throw Error('offline');}},
  {async read(){return state();},async compareAndSwap(){return false;}}
 ]){
  const r=await runPersistentPaperTick(storage,'m1',[quote()],settings(),Date.now());
  assert.equal(r.status,'blocked');assert.equal(r.orderId,null);
 }
});
