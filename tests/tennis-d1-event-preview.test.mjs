import test from 'node:test';import assert from 'node:assert/strict';
import {previewTennisD1Events} from '../src/lib/intelligence-core/tennis-d1-event-preview.mjs';
test('tennis event preview requires provenance and never certifies odds',()=>{
 const x=previewTennisD1Events([{id:'a1',tournament:'ATP Example',startTime:'2026-10-20T12:00:00Z'}],{source:'provider-a',observedAt:'2026-10-19T18:00:00Z'});
 assert.equal(x.items.length,1);assert.equal(x.items[0].id,'provider-a:tennis:a1');
 assert.equal(x.items[0].sport,'tennis');assert.equal(x.sportsbookOddsAvailable,false);
 assert.equal(x.draftKingsInventoryCertified,false);assert.equal(x.previewOnly,true);
 assert.equal(previewTennisD1Events([],{}).reason,'INVALID_SOURCE');
});
test('tennis preview enforces idempotent ids and a bounded batch',()=>{
 const records=Array.from({length:30},(_,i)=>({id:String(i),tournament:'WTA Example',startTime:'2026-10-20T12:00:00Z'}));
 records.push(records[0]);
 const x=previewTennisD1Events(records,{source:'provider-b',observedAt:'2026-10-19T18:00:00Z'});
 assert.equal(x.items.length,25);assert.equal(x.totalObserved,30);assert.equal(x.rejected,1);assert.equal(x.truncated,true);
});
