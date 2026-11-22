import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/paperScalpSnapshot.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {validatePaperScalpSnapshot,advanceSnapshotRevision}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const cycle=()=>({marketId:'m1',enabled:true,killSwitch:false,maxPosition:10,maxBuyPrice:.4,targetNetPerContract:.02,buyFeePerContract:.01,sellFeePerContract:.01,nextOrderSequence:2});
const snapshot=()=>({version:1,revision:0,cycle:cycle(),book:{orders:[],fills:[],owned:0,cashFlow:0}});
test('empty snapshot validates and revision advances exactly once',()=>{
 const s=snapshot();assert.equal(validatePaperScalpSnapshot(s).valid,true);
 const next=advanceSnapshotRevision(s,0,s.book,s.cycle);
 assert.equal(next.revision,1);
 assert.equal(advanceSnapshotRevision(next,0,next.book,next.cycle),null);
});
test('recovery rejects inconsistent inventory and cash flow',()=>{
 const s=snapshot();s.book.owned=1;
 assert.ok(validatePaperScalpSnapshot(s).reasons.includes('inventory_mismatch'));
 s.book.owned=0;s.book.cashFlow=10;
 assert.ok(validatePaperScalpSnapshot(s).reasons.includes('cashflow_mismatch'));
});
test('duplicate fill IDs and mismatched filled quantities fail closed',()=>{
 const s=snapshot();
 s.book.orders=[{id:'buy',side:'buy',limitPrice:.4,quantity:2,filled:2,status:'filled'}];
 s.book.fills=[{id:'f',orderId:'buy',quantity:1,price:.4},{id:'f',orderId:'buy',quantity:1,price:.4}];
 s.book.owned=2;s.book.cashFlow=-.8;
 const result=validatePaperScalpSnapshot(s);
 assert.equal(result.valid,false);
 assert.ok(result.reasons.includes('invalid_fill'));
 assert.ok(result.reasons.includes('fill_count_mismatch'));
});
test('valid partial buy fill and reserved sell inventory are preserved',()=>{
 const s=snapshot();
 s.book.orders=[
  {id:'buy',side:'buy',limitPrice:.4,quantity:3,filled:2,status:'partially_filled'},
  {id:'sell',side:'sell',limitPrice:.45,quantity:2,filled:0,status:'open'}
 ];
 s.book.fills=[{id:'fill',orderId:'buy',quantity:2,price:.4}];
 s.book.owned=2;s.book.cashFlow=-.8;
 assert.equal(validatePaperScalpSnapshot(s).valid,true);
});
