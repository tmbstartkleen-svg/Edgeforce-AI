import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {loadProvider} from './helpers/load-provider.mjs';

const configured=process.env.SHARP_TEST_DATABASE_URL;
assert.ok(configured,'SHARP_TEST_DATABASE_URL is required; this mandatory integration test must not silently skip');
const target=new URL(configured);
assert.ok(['127.0.0.1','localhost'].includes(target.hostname)&&target.pathname==='/edgeforce_snapshot_test','Only the local CI fixture database is permitted');
const sql=postgres(configured,{max:6,prepare:false});
const a=loadProvider('sharedSharpFeed',{'../db':{db:()=>sql}});
const b=loadProvider('sharedSharpFeed',{'../db':{db:()=>sql}});
const keys=[];
const freshKey=()=>`fixture-${randomUUID()}`;
const value={schema:1,rows:[],receivedAt:Date.now(),delaySeconds:60,pages:1,truncated:false};
try{
 await test('concurrent cold instances share exactly one upstream lease',async()=>{
  const key=freshKey();
  const leases=await Promise.all(Array.from({length:18},(_,i)=>(i%2?a:b).acquireSharpLease(key)));
  const owners=leases.filter(x=>x.kind==='lease');assert.equal(owners.length,1);
  assert.equal(leases.filter(x=>x.kind==='hold').length,17);
  const owner=owners[0];keys.push(owner.key);
  assert.notEqual(owner.key,key);assert.match(owner.key,/^[0-9a-f]{64}$/);
  await a.finishSharpLease(owner,value);
  for(const api of [a,b]){
   const cached=await api.acquireSharpLease(key);
   assert.equal(cached.kind,'cached');assert.equal(cached.snapshot.receivedAt,value.receivedAt);
  }
 });
 await test('Retry-After persists across instances rather than only in memory',async()=>{
  const key=freshKey();const owner=await a.acquireSharpLease(key);assert.equal(owner.kind,'lease');keys.push(owner.key);
  await a.finishSharpLease(owner,null,180000);
  const hold=await b.acquireSharpLease(key);assert.equal(hold.kind,'hold');assert.ok(hold.retryAfterMs>179000);
 });
 await test('expired owners cannot overwrite a successor cache',async()=>{
  const key=freshKey();const old=await a.acquireSharpLease(key);assert.equal(old.kind,'lease');keys.push(old.key);
  await sql`update public.edgeforce_sharp_feed_v1 set next_fetch_at='epoch',lease_until='epoch' where credential_hash=${old.key}`;
  const next=await b.acquireSharpLease(key);assert.equal(next.kind,'lease');assert.notEqual(next.token,old.token);
  await assert.rejects(()=>a.finishSharpLease(old,value),/lost.*lease/);
  await b.finishSharpLease(next,{...value,receivedAt:value.receivedAt+1});
  assert.equal((await a.acquireSharpLease(key)).snapshot.receivedAt,value.receivedAt+1);
 });
 await test('bounded stale cache never escapes a longer upstream cooldown',async()=>{
  const key=freshKey();const owner=await a.acquireSharpLease(key);assert.equal(owner.kind,'lease');keys.push(owner.key);
  await a.finishSharpLease(owner,value,600000);
  await sql`update public.edgeforce_sharp_feed_v1 set cached_at=clock_timestamp()-interval '90 seconds' where credential_hash=${owner.key}`;
  const cached=await b.acquireSharpLease(key);assert.equal(cached.kind,'cached');assert.equal(cached.coolingDown,true);
  await sql`update public.edgeforce_sharp_feed_v1 set cached_at=clock_timestamp()-interval '181 seconds' where credential_hash=${owner.key}`;
  const hold=await b.acquireSharpLease(key);assert.equal(hold.kind,'hold');assert.ok(hold.retryAfterMs>598000);
 });
 await test('malformed cache fails closed and does not create an extra refresh',async()=>{
  const key=freshKey();const owner=await a.acquireSharpLease(key);assert.equal(owner.kind,'lease');keys.push(owner.key);
  await a.finishSharpLease(owner,value,180000);
  await sql`update public.edgeforce_sharp_feed_v1 set payload=${sql.json({schema:1,rows:'invalid'})} where credential_hash=${owner.key}`;
  assert.equal((await b.acquireSharpLease(key)).kind,'hold');
 });
}finally{
 for(const key of keys)await sql`delete from public.edgeforce_sharp_feed_v1 where credential_hash=${key}`;
 await sql.end({timeout:5});
}
