import test from 'node:test';import assert from 'node:assert/strict';
import {previewTennisD1Batches} from '../src/lib/intelligence-core/tennis-d1-event-preview.mjs';
test('tennis staging preserves over 100 matches without losing records',()=>{
 const records=Array.from({length:130},(_,i)=>({id:'m'+i,tournament:i%2?'ATP':'WTA',startTime:'2026-10-21T10:00:00Z'}));
 records.push(records[0]);
 const out=previewTennisD1Batches(records,{source:'provider-t',observedAt:'2026-10-19T20:00:00Z'});
 assert.equal(out.totalObserved,130);assert.equal(out.rejected,1);
 assert.equal(out.batches.length,6);assert.equal(out.batches.reduce((n,b)=>n+b.items.length,0),130);
 assert.ok(out.batches.every(b=>b.items.length<=25&&b.previewOnly));
 assert.equal(out.sportsbookOddsAvailable,false);assert.equal(out.ingestionEnabled,false);
});
test('tennis staging refuses missing provider provenance',()=>{
 const out=previewTennisD1Batches([{id:'1',tournament:'ATP',startTime:'2026-10-21T10:00:00Z'}],{});
 assert.equal(out.complete,false);assert.deepEqual(out.batches,[]);
});
