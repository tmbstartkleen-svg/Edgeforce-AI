import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import postgres from 'postgres';

const url=new URL(process.env.WAREHOUSE_TEST_DATABASE_URL||'postgres://disabled');
if(!['postgres:','postgresql:'].includes(url.protocol)||
 !['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/edgeforce_snapshot_test'){
 throw new Error('V208 warehouse test requires the dedicated local edgeforce_snapshot_test database');
}
const sql=postgres(url.toString(),{max:3,prepare:false});
const ts=createRequire(import.meta.url)('typescript');
const code=readFileSync(new URL('../src/lib/sportsArchiveSync.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics?.length??0,0);
const fixture={exports:{}};
new Function('require','module','exports',compiled.outputText)(id=>{
 if(id==='@/lib/db')return {db:()=>sql};
 throw Error('Unexpected module '+id);
},fixture,fixture.exports);
const archive=fixture.exports;
const migration=readFileSync(new URL('../db/v208.sql',import.meta.url),'utf8');
const eventId='fixture-v208-NFL-game';
try{
 await sql.unsafe(migration);
 await sql.unsafe("create table if not exists events(id text primary key,sport text not null,league text,start_time timestamptz not null)");
 await sql.unsafe("create table if not exists market_snapshots(id bigserial primary key,event_id text not null,provider text not null,bookmaker text not null,market_key text not null,selection_key text not null,american_odds int not null,pulled_at timestamptz default now(),raw jsonb default '{}'::jsonb)");
 await sql.unsafe("create table if not exists model_runs(id bigserial primary key,event_id text not null,model_version text not null,market_key text not null,selection_key text not null,model_probability numeric,simulation_probability numeric,simulation_ci_low numeric,simulation_ci_high numeric,run_count integer,created_at timestamptz default now())");
 await sql.unsafe("create table if not exists player_game_stats(id bigserial primary key,event_id text not null,athlete_id text not null,source text,stats jsonb not null,stat_date timestamptz,imported_at timestamptz default now())");
 await sql`insert into events(id,sport,league,start_time)
  values(${eventId},'NFL','NFL','2026-10-11T20:00:00Z') on conflict(id) do nothing`;
 const [allowed]=await sql`insert into market_snapshots(
  event_id,provider,bookmaker,market_key,selection_key,american_odds,raw)
 values(${eventId},'fixture-sharp','DraftKings','h2h','Fixture Team',-120,
  ${sql.json({sourceTimestamp:'2026-10-10T20:00:00Z'})}) returning id`;
 await sql`insert into market_snapshots(
  event_id,provider,bookmaker,market_key,selection_key,american_odds,raw)
 values(${eventId},'unapproved-feed','FanDuel','h2h','Fixture Team',-115,
  ${sql.json({sourceTimestamp:'2026-10-10T20:01:00Z'})})`;
 await sql`insert into model_runs(event_id,model_version,market_key,selection_key,model_probability,
  simulation_probability,simulation_ci_low,simulation_ci_high,run_count)
 values(${eventId},'model-fixture','h2h','Fixture Team',0.59,0.59,0.56,0.62,10000)`;
 await sql`insert into player_game_stats(event_id,athlete_id,source,stats,stat_date)
 values(${eventId},'fixture-player','fixture-licensed',
  ${sql.json({passing_yards:198})},'2026-10-11T20:00:00Z')`;

 await test('V208 PostgreSQL archive copies approved odds, excludes unlicensed providers',async()=>{
  const v=await archive.syncSportsArchive('MARKET_OBSERVATION',['fixture-sharp']);
  assert.equal(v.status,'COPIED');
  assert.equal(v.inserted,1);
  const rows=await sql`select * from public.edgeforce_sports_archive_v208 where record_type='MARKET_OBSERVATION'`;
  assert.equal(rows.length,1);
  assert.equal(Number(rows[0].source_record_id),Number(allowed.id));
  assert.equal(rows[0].source_provider,'fixture-sharp');
  assert.equal(rows[0].data.bookmaker,'DraftKings');
 });
 await test('V208 shared cooldown prevents duplicate inserts even with concurrent calls',async()=>{
  const cooldown=await archive.syncSportsArchive('MARKET_OBSERVATION',['fixture-sharp']);
  assert.equal(cooldown.status,'COOLDOWN');
  await sql`update public.edgeforce_sports_archive_sync_v208 set next_allowed_at='epoch',last_source_id=0
   where record_type='MARKET_OBSERVATION'`;
  const results=await Promise.all([
   archive.syncSportsArchive('MARKET_OBSERVATION',['fixture-sharp']),
   archive.syncSportsArchive('MARKET_OBSERVATION',['fixture-sharp'])
  ]);
  assert.equal(results.filter(x=>x.status==='COOLDOWN').length,1);
  assert.equal(results.filter(x=>x.status==='NO_NEW_RECORDS').length,1);
  const [count]=await sql`select count(*)::int as n from public.edgeforce_sports_archive_v208
   where record_type='MARKET_OBSERVATION'`;
  assert.equal(count.n,1);
 });
 await test('V208 model runs archive as research rather than real-world outcomes',async()=>{
  const v=await archive.syncSportsArchive('MODEL_FORECAST',[]);
  assert.equal(v.inserted,1);
  const [saved]=await sql`select * from public.edgeforce_sports_archive_v208
   where record_type='MODEL_FORECAST'`;
  assert.equal(saved.source_provider,'EDGEFORCE_MODEL');
  assert.equal(Number(saved.data.modelProbability),0.59);
 });
 await test('V208 player source rights guard and retained stat provenance',async()=>{
  await assert.rejects(()=>archive.syncSportsArchive('PLAYER_STAT',[]),/SOURCE_RIGHTS/);
  const v=await archive.syncSportsArchive('PLAYER_STAT',['fixture-licensed']);
  assert.equal(v.inserted,1);
  const [saved]=await sql`select * from public.edgeforce_sports_archive_v208
   where record_type='PLAYER_STAT'`;
  assert.equal(saved.source_provider,'fixture-licensed');
  assert.equal(saved.data.stats.passing_yards,198);
 });
}finally{
 await sql`delete from public.edgeforce_sports_archive_v208 where event_id=${eventId}`;
 await sql`update public.edgeforce_sports_archive_sync_v208 set last_source_id=0,
  attempted_batches=0,copied_records=0,last_batch_at=null,next_allowed_at='epoch'`;
 await sql`delete from player_game_stats where event_id=${eventId}`;
 await sql`delete from model_runs where event_id=${eventId}`;
 await sql`delete from market_snapshots where event_id=${eventId}`;
 await sql`delete from events where id=${eventId}`;
 await sql.end({timeout:5});
}
