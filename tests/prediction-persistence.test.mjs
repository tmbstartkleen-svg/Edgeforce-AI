import assert from 'node:assert/strict';
import {test} from 'node:test';
import {predictionStore,fakeDatabase,contract} from './helpers/prediction-store-fixture.mjs';

for(const columns of [[],['provider'],['no_probability'],['provider','no_probability']]){
 test(`snapshot writer supports schema columns ${columns.join(',')||'modern'}`,async()=>{
  const database=fakeDatabase({columns});const store=await predictionStore(database.sql);
  try{
   assert.deepEqual(await store.persist([contract]),{stateWritten:1,snapshotsWritten:1,mode:'database'});
   const row=database.writes.find(write=>write.snapshot).snapshot;
   assert.equal(row.yes_probability,contract.yesProbability);
   assert.equal(row.raw.json.noProbability,contract.noProbability);
   assert.equal(row.no_probability,columns.includes('no_probability')?contract.noProbability:undefined);
   assert.equal(row.provider,columns.includes('provider')?contract.source:undefined);
   assert.equal(new Date(row.observed_hour).getUTCMinutes(),0);
   assert.deepEqual(database.stats(),{commits:1,rollbacks:0,discoveries:1});
  }finally{store.dispose();}
 });
}

test('provided No probability is retained rather than replaced by 1 minus Yes',async()=>{
 const database=fakeDatabase({columns:['no_probability']});const store=await predictionStore(database.sql);
 try{
  await store.persist([contract]);
  const row=database.writes.find(write=>write.snapshot).snapshot;
  assert.equal(row.no_probability,0.39);assert.notEqual(row.no_probability,1-row.yes_probability);
 }finally{store.dispose();}
});

test('invalid probabilities reject the whole selected batch before any query or write',async()=>{
 for(const field of ['yesProbability','noProbability']){
  for(const value of [undefined,null,NaN,Infinity,-0.1,1.01,'0.4']){
   const database=fakeDatabase();const store=await predictionStore(database.sql);
   try{
    await assert.rejects(()=>store.persist([contract,{...contract,id:'invalid',volume:0,[field]:value}]),/finite Yes and No/);
    assert.equal(database.queries.length,0);assert.equal(database.writes.length,0);
   }finally{store.dispose();}
  }
 }
});

test('missing source identity is rejected rather than synthesized',async()=>{
 const database=fakeDatabase();const store=await predictionStore(database.sql);
 try{
  for(const source of [null,undefined,'',' '])await assert.rejects(()=>store.persist([{...contract,source}]),/identity/);
  assert.equal(database.writes.length,0);
 }finally{store.dispose();}
});

test('snapshot failure rolls back its state update and reports failure',async()=>{
 const database=fakeDatabase({columns:['no_probability'],rejectSnapshot:true});const store=await predictionStore(database.sql);
 try{
  await assert.rejects(()=>store.persist([contract]),/fixture snapshot failure/);
  assert.equal(database.writes.length,0);
  assert.deepEqual(database.stats(),{commits:0,rollbacks:1,discoveries:1});
 }finally{store.dispose();}
});

test('duplicate hourly snapshot still permits an atomic state refresh without counting a new snapshot',async()=>{
 const database=fakeDatabase({duplicate:true});const store=await predictionStore(database.sql);
 try{
  assert.deepEqual(await store.persist([contract]),{stateWritten:1,snapshotsWritten:0,mode:'database'});
  assert.equal(database.writes.length,1);
 }finally{store.dispose();}
});

test('state-only writes do not inspect or access the snapshot table',async()=>{
 const database=fakeDatabase({rejectSnapshot:true});const store=await predictionStore(database.sql);
 try{
  assert.deepEqual(await store.persist([contract],false),{stateWritten:1,snapshotsWritten:0,mode:'database'});
  assert.equal(database.stats().discoveries,0);
  assert.equal(database.writes.length,1);
 }finally{store.dispose();}
});

test('schema knowledge is isolated between databases and is discovered once per batch',async()=>{
 const modern=fakeDatabase(),legacy=fakeDatabase({columns:['no_probability']});
 const a=await predictionStore(modern.sql),b=await predictionStore(legacy.sql);
 try{
  await Promise.all([a.persist([contract,{...contract,id:'second'}]),b.persist([contract])]);
  assert.equal(modern.stats().discoveries,1);assert.equal(legacy.stats().discoveries,1);
  assert.equal(modern.writes[1].snapshot.no_probability,undefined);
  assert.equal(legacy.writes[1].snapshot.no_probability,0.39);
 }finally{a.dispose();b.dispose();}
});

test('no database does not claim persistence',async()=>{
 const store=await predictionStore(null);
 try{assert.deepEqual(await store.persist([contract]),{stateWritten:0,snapshotsWritten:0,mode:'memory'});}
 finally{store.dispose();}
});
