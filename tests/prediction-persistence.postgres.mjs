import assert from 'node:assert/strict';
import {test} from 'node:test';
import postgres from 'postgres';
import {predictionStore,contract} from './helpers/prediction-store-fixture.mjs';

// Never run schema fixtures against an application or remote database.
const url=new URL(process.env.PREDICTION_TEST_DATABASE_URL||'postgres://disabled');
if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/edgeforce_snapshot_test'){
 throw new Error('A dedicated loopback edgeforce_snapshot_test database is required');
}

async function schema(sql,legacy){
 await sql`drop table if exists public.prediction_market_snapshots`;
 await sql`drop table if exists public.prediction_market_state`;
 await sql`
  create table public.prediction_market_state(
   venue text not null,contract_id text not null,title text not null,category text not null,
   yes_probability numeric not null,bid_probability numeric,ask_probability numeric,
   volume numeric,liquidity numeric,expires_at timestamptz,raw jsonb not null,updated_at timestamptz not null,
   primary key(venue,contract_id)
  )
 `;
 await sql`
  create table public.prediction_market_snapshots(
   id bigserial primary key,venue text not null,contract_id text not null,title text not null,
   category text not null,yes_probability numeric not null,bid_probability numeric,ask_probability numeric,
   volume numeric,liquidity numeric,observed_hour timestamptz not null,raw jsonb not null,
   unique(venue,contract_id,observed_hour)
  )
 `;
 if(legacy)await sql`
  alter table public.prediction_market_snapshots add column provider text not null,
   add column no_probability numeric not null check(no_probability between 0 and 1)
 `;
}

test('actual PostgreSQL validates modern and legacy snapshot writes, idempotency and rollback',async()=>{
 const sql=postgres(url.toString(),{max:1,prepare:false,onnotice:()=>{}});
 const store=await predictionStore(sql);
 try{
  for(const legacy of [false,true]){
   await schema(sql,legacy);
   assert.deepEqual(await store.persist([contract]),{stateWritten:1,snapshotsWritten:1,mode:'database'});
   const [saved]=await sql`select * from public.prediction_market_snapshots`;
   assert.equal(saved.raw.noProbability,0.39);
   if(legacy){assert.equal(Number(saved.no_probability),0.39);assert.equal(saved.provider,contract.source);}
   assert.deepEqual(await store.persist([{...contract,title:'Updated fixture title'}]),{stateWritten:1,snapshotsWritten:0,mode:'database'});
   assert.equal((await sql`select title from public.prediction_market_state`)[0].title,'Updated fixture title');
   assert.equal((await sql`select count(*)::int as count from public.prediction_market_snapshots`)[0].count,1);
   // Force a real database constraint failure after a state update. The update
   // must roll back, preserving the last committed value rather than a half-write.
   await sql`delete from public.prediction_market_snapshots`;
   await sql`alter table public.prediction_market_snapshots add constraint fixture_reject check(title <> 'Reject fixture')`;
   await assert.rejects(()=>store.persist([{...contract,title:'Reject fixture'}]),error=>error.code==='23514');
   assert.equal((await sql`select title from public.prediction_market_state`)[0].title,'Updated fixture title');
   assert.equal((await sql`select count(*)::int as count from public.prediction_market_snapshots`)[0].count,0);
  }
 }finally{
  store.dispose();
  await sql`drop table if exists public.prediction_market_snapshots`;
  await sql`drop table if exists public.prediction_market_state`;
  await sql.end({timeout:5});
 }
});
