import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const base='data:text/javascript;base64,'+Buffer.from(transpile(readFileSync(new URL('../src/lib/paperScalpOrderEngine.ts',import.meta.url),'utf8'))).toString('base64');
const source=transpile(readFileSync(new URL('../src/lib/paperScalpLedger.ts',import.meta.url),'utf8')).replace(/from ['"]\.\/paperScalpOrderEngine['"]/g,"from '"+base+"'");
const {applyDurablePaperEvent,validatePaperLedgerSnapshot}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const initial=()=>({schemaVersion:1,marketId:'m1',revision:0,book:{orders:[],fills:[],owned:0,cashFlow:0},cycle:{marketId:'m1'},processedEventIds:[]});
const buy={type:'place',order:{id:'buy-1',side:'buy',limitPrice:.4,quantity:2,filled:0,status:'open'}};
test('revision and event ID prevent duplicate durable paper orders',()=>{
 const first=applyDurablePaperEvent(initial(),'evt1',0,buy);
 assert.equal(first.accepted,true);assert.equal(first.state.revision,1);
 assert.equal(applyDurablePaperEvent(first.state,'evt1',1,buy).reason,'duplicate_event');
 assert.equal(applyDurablePaperEvent(first.state,'evt2',0,buy).reason,'revision_conflict');
 assert.equal(validatePaperLedgerSnapshot(first.state),true);
});
test('confirmed paper fill survives serialized snapshot recovery',()=>{
 const first=applyDurablePaperEvent(initial(),'evt1',0,buy).state;
 const second=applyDurablePaperEvent(first,'evt2',1,{type:'fill',fill:{id:'fill-1',orderId:'buy-1',quantity:1,price:.39}});
 assert.equal(second.accepted,true);
 const recovered=JSON.parse(JSON.stringify(second.state));
 assert.equal(validatePaperLedgerSnapshot(recovered),true);
 assert.equal(recovered.book.owned,1);
 assert.equal(applyDurablePaperEvent(recovered,'evt2',2,{type:'fill',fill:{id:'fill-1',orderId:'buy-1',quantity:1,price:.39}}).accepted,false);
});
test('tampered inventory is rejected on recovery',()=>{
 const s=applyDurablePaperEvent(initial(),'evt1',0,buy).state;
 s.book.owned=4;
 assert.equal(validatePaperLedgerSnapshot(s),false);
});
