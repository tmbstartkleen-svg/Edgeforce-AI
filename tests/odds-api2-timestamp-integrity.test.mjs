import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureNow,loadOddsApi2Normalizer,oddsApi2Payload} from './helpers/load-odds-api2.mjs';

test('normalization preserves the actual provider timestamp, bookmaker and price',()=>{
 const sourceTime=new Date(fixtureNow-90000).toISOString();
 const runtime=loadOddsApi2Normalizer();
 const rows=runtime.normalize(oddsApi2Payload({updated_at:sourceTime}));
 assert.equal(rows.length,1);
 assert.equal(rows[0].pulledAt,sourceTime);
 assert.notEqual(rows[0].pulledAt,new Date(fixtureNow).toISOString());
 assert.equal(rows[0].bookmaker,'DraftKings');
 assert.equal(rows[0].odds,120);
 assert.equal(rows[0].selection,'Home Team');
 assert.equal(runtime.networkRequests,0);
});

test('last_update supplies the source timestamp when updated_at is absent',()=>{
 const sourceTime=new Date(fixtureNow-120000).toISOString();
 const runtime=loadOddsApi2Normalizer();
 for(const updated_at of [undefined,null]){
  const rows=runtime.normalize(oddsApi2Payload({updated_at,last_update:sourceTime}));
  assert.equal(rows.length,1);
  assert.equal(rows[0].pulledAt,sourceTime);
 }
 assert.equal(runtime.networkRequests,0);
});

test('missing, invalid and non-string provider timestamps cannot supply accepted odds',()=>{
 const runtime=loadOddsApi2Normalizer();
 for(const invalid of [undefined,null,'','not-a-date',123,true,[],{}]){
  for(const field of ['updated_at','last_update']){
   const rows=runtime.normalize(oddsApi2Payload({[field]:invalid}));
   assert.equal(rows.length,0,`${field}=${JSON.stringify(invalid)}`);
  }
 }
 assert.equal(runtime.networkRequests,0);
});

test('receipt and event timestamps cannot replace missing bookmaker observation evidence',()=>{
 const receiptTime=new Date(fixtureNow).toISOString();
 const payload=oddsApi2Payload({pulledAt:receiptTime,receivedAt:receiptTime});
 payload.receivedAt=receiptTime;
 payload.updated_at=receiptTime;
 payload.data[0].updated_at=receiptTime;
 const runtime=loadOddsApi2Normalizer();
 assert.equal(runtime.normalize(payload).length,0);
 assert.equal(runtime.networkRequests,0);
});

test('an invalid primary observation is not repaired by borrowing a different timestamp',()=>{
 const runtime=loadOddsApi2Normalizer();
 const freshTime=new Date(fixtureNow-60000).toISOString();
 for(const invalid of ['','invalid-time',123]){
  assert.equal(runtime.normalize(oddsApi2Payload({updated_at:invalid,last_update:freshTime})).length,0);
 }
 assert.equal(runtime.networkRequests,0);
});

test('invalid books do not prevent independently timestamped valid rows from being returned',()=>{
 const sourceTime=new Date(fixtureNow-1000).toISOString();
 const payload=oddsApi2Payload({updated_at:sourceTime});
 payload.data[0].books.push({book:'fanduel',market:'h2h',outcomes:[{name:'Away Team',price:130}]});
 const runtime=loadOddsApi2Normalizer();
 const rows=runtime.normalize(payload);
 assert.equal(rows.length,1);
 assert.equal(rows[0].bookmaker,'DraftKings');
 assert.equal(rows[0].pulledAt,sourceTime);
 assert.equal(runtime.networkRequests,0);
});
