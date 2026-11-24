import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const paper='data:text/javascript;base64,'+Buffer.from(transpile(readFileSync(new URL('../src/lib/paperScalpOrderEngine.ts',import.meta.url),'utf8'))).toString('base64');
const cycleJs=transpile(readFileSync(new URL('../src/lib/paperAutomatedScalpCycle.ts',import.meta.url),'utf8')).replace(/from ['"]\.\/paperScalpOrderEngine['"]/g,"from '"+paper+"'");
const {advancePaperScalp}=await import('data:text/javascript;base64,'+Buffer.from(cycleJs).toString('base64'));
const {applyPaperEvent}=await import(paper);
const settings=()=>({marketId:'demo',enabled:true,killSwitch:false,maxPosition:10,maxBuyPrice:.40,targetNetPerContract:.02,buyFeePerContract:.01,sellFeePerContract:.01,nextOrderSequence:1});
const quote={bestBid:.38,bestAsk:.41,ageMs:100,marketOpen:true};
const empty=()=>({orders:[],fills:[],owned:0,cashFlow:0});
test('paper buy only becomes sell after confirmed fill',()=>{
 const start=advancePaperScalp(empty(),settings(),quote);
 assert.equal(start.status,'paper_order_created');assert.equal(start.order.side,'buy');
 assert.equal(advancePaperScalp(start.book,start.cycle,quote).status,'waiting');
 const filled=applyPaperEvent(start.book,{type:'fill',fill:{id:'fill1',orderId:start.order.id,quantity:4,price:.38}});
 assert.equal(filled.accepted,true);
 const next=advancePaperScalp(filled.book,start.cycle,quote);
 assert.equal(next.order.side,'sell');assert.equal(next.order.quantity,4);
 assert.ok(next.order.limitPrice>=.42);
});
test('kill switch prevents new orders',()=>{
 const result=advancePaperScalp(empty(),{...settings(),killSwitch:true},quote);
 assert.equal(result.status,'blocked');assert.equal(result.book.orders.length,0);
});
test('stale quotes block paper orders',()=>{
 assert.equal(advancePaperScalp(empty(),settings(),{...quote,ageMs:90000}).status,'blocked');
});
test('duplicate fills are not applied twice',()=>{
 const first=advancePaperScalp(empty(),settings(),quote);
 const event={type:'fill',fill:{id:'unique',orderId:first.order.id,quantity:1,price:.38}};
 const filled=applyPaperEvent(first.book,event);
 assert.equal(filled.accepted,true);
 assert.equal(applyPaperEvent(filled.book,event).accepted,false);
});
