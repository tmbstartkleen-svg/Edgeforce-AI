import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const paper=data(compile(read('../src/lib/paperScalpOrderEngine.ts')));
const cycle=data(compile(read('../src/lib/paperAutomatedScalpCycle.ts')).replace(/from ['"]\.\/paperScalpOrderEngine['"]/g,"from '"+paper+"'"));
const rank=data(compile(read('../src/lib/crossVenuePaperScalpRanking.ts')));
const dispatcher=data(compile(read('../src/lib/paperScalpQuoteDispatcher.ts'))
 .replace(/from ['"]\.\/paperAutomatedScalpCycle['"]/g,"from '"+cycle+"'")
 .replace(/from ['"]\.\/crossVenuePaperScalpRanking['"]/g,"from '"+rank+"'"));
const {dispatchPaperScalpFromQuotes}=await import(dispatcher);
const book=()=>({orders:[],fills:[],owned:0,cashFlow:0});
const cycleSettings=()=>({marketId:'m1',enabled:true,killSwitch:false,maxPosition:5,maxBuyPrice:.42,targetNetPerContract:.02,buyFeePerContract:.005,sellFeePerContract:.005,nextOrderSequence:1});
const risk=()=>({maxSpread:.1,minimumNetPerContract:.01,buyFeePerContract:.005,sellFeePerContract:.005,maxContracts:5,tickSize:.01});
const quote=()=>({venue:'kalshi',marketId:'m1',outcomeId:'yes',status:'verified_read_only',bestBid:.4,bestAsk:.45,bidDepth:5,askDepth:5,ageMs:100});
test('verified quote dispatches only a paper buy order',()=>{
 const r=dispatchPaperScalpFromQuotes([quote()],risk(),book(),cycleSettings(),Date.now());
 assert.equal(r.status,'paper_order_created');assert.match(r.orderId,/paper-buy/);
 assert.equal(r.book.orders.length,1);assert.equal(r.book.owned,0);
});
test('unverified quote and kill switch prevent dispatch',()=>{
 assert.equal(dispatchPaperScalpFromQuotes([{...quote(),status:'blocked'}],risk(),book(),cycleSettings(),Date.now()).status,'blocked');
 assert.equal(dispatchPaperScalpFromQuotes([quote()],risk(),book(),{...cycleSettings(),killSwitch:true},Date.now()).status,'blocked');
});

test('stale quote and insufficient quoted depth fail closed',()=>{
 const stale=dispatchPaperScalpFromQuotes([{...quote(),ageMs:90000}],risk(),book(),cycleSettings(),Date.now());
 assert.equal(stale.status,'blocked');assert.equal(stale.book.orders.length,0);
 const emptyDepth=dispatchPaperScalpFromQuotes([{...quote(),askDepth:0}],risk(),book(),cycleSettings(),Date.now());
 assert.equal(emptyDepth.status,'blocked');assert.equal(emptyDepth.book.orders.length,0);
});
test('insufficient after-fee spread fails closed',()=>{
 const r=dispatchPaperScalpFromQuotes([{...quote(),bestAsk:.41}],{...risk(),buyFeePerContract:.04},book(),cycleSettings(),Date.now());
 assert.equal(r.status,'blocked');assert.equal(r.book.orders.length,0);
});

test('ambiguous exchange or outcome identity cannot create paper orders',()=>{
 for(const other of [{...quote(),venue:'polymarket_us'},{...quote(),outcomeId:'no'}]){
  const r=dispatchPaperScalpFromQuotes([quote(),other],risk(),book(),cycleSettings(),Date.now());
  assert.equal(r.status,'blocked');assert.equal(r.reason,'ambiguous_market_identity');
  assert.equal(r.book.orders.length,0);
 }
});
