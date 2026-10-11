import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
const uri=process.env.OUTCOME_TEST_DATABASE_URL;
assert.ok(uri,'OUTCOME_TEST_DATABASE_URL must be configured for this mandatory fixture test');
const url=new URL(uri);
assert.ok(['postgres:','postgresql:'].includes(url.protocol)&&
 ['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/edgeforce_snapshot_test',
 'Test must never contact production databases');
const sql=postgres(uri,{max:4,prepare:false});
const tag='fixture-v209-'+randomUUID();
try{
 await sql.unsafe(readFileSync(new URL('../db/v209.sql',import.meta.url),'utf8'));
 const a={source:'fixture-score',sourceEventKey:tag,sport:'NFL',league:'NFL',
  homeName:'Fixture Home',awayName:'Fixture Away',scheduledAt:'2026-10-09T20:00:00Z',
  homeScore:21,awayScore:17};
 const insertScore=async rows=>sql`
  insert into public.edgeforce_sports_outcomes_v209(
   source,source_event_key,sport,league,home_name,away_name,
   scheduled_at,home_score,away_score,source_observed_at)
  select r.source,r."sourceEventKey",r.sport,r.league,r."homeName",r."awayName",
   r."scheduledAt"::timestamptz,r."homeScore",r."awayScore",null
  from jsonb_to_recordset(${sql.json(rows)}::jsonb)
   as r(source text,"sourceEventKey" text,sport text,league text,
    "homeName" text,"awayName" text,"scheduledAt" text,
    "homeScore" int,"awayScore" int)
  where true on conflict(source,source_event_key,home_score,away_score) do nothing returning id`;
 await test('V209 PostgreSQL score history dedupes duplicates and preserves legitimate score revisions',async()=>{
  assert.equal((await insertScore([a])).length,1);
  assert.equal((await insertScore([a])).length,0);
  assert.equal((await insertScore([{...a,homeScore:22}])).length,1);
  const rows=await sql`select home_score,away_score,verification,source_observed_at
   from public.edgeforce_sports_outcomes_v209 where source_event_key=${tag} order by id`;
  assert.deepEqual(rows.map(r=>r.home_score),[21,22]);
  assert.ok(rows.every(r=>r.verification==='SINGLE_SOURCE'&&r.source_observed_at===null));
  await assert.rejects(()=>insertScore([{...a,homeScore:-1}]),err=>err.code==='23514');
 });
 const event={source:'fixture-pbp',sourceEventKey:tag,sourcePlayKey:'p1',
  sport:'NFL',observedAt:'2026-10-09T20:10:02Z',
  eventTime:'2026-10-09T20:10:00Z',periodLabel:'Q1',
  clockLabel:'12:10',description:'Test pass complete',playerName:'Fixture Player',
  teamName:'Fixture Team',rawStats:{yards:12}};
 const insertPlays=async plays=>sql`
  insert into public.edgeforce_sports_plays_v209(
   source,source_event_key,source_play_key,sport,observed_at,event_time,
   period_label,clock_label,description,player_name,team_name,raw_stats)
  select r.source,r."sourceEventKey",r."sourcePlayKey",r.sport,
   r."observedAt"::timestamptz,r."eventTime"::timestamptz,r."periodLabel",
   r."clockLabel",r.description,r."playerName",r."teamName",r."rawStats"
  from jsonb_to_recordset(${sql.json(plays)}::jsonb)
   as r(source text,"sourceEventKey" text,"sourcePlayKey" text,sport text,
    "observedAt" text,"eventTime" text,"periodLabel" text,"clockLabel" text,
    description text,"playerName" text,"teamName" text,"rawStats" jsonb)
  where true on conflict(source,source_event_key,source_play_key) do nothing returning id`;
 await test('V209 licensed play-by-play import preserves source play identity and does not duplicate',async()=>{
  assert.equal((await insertPlays([event])).length,1);
  assert.equal((await insertPlays([event])).length,0);
  assert.equal((await insertPlays([{...event,sourcePlayKey:'p2'}])).length,1);
  const rows=await sql`select source,verification,raw_stats from public.edgeforce_sports_plays_v209
   where source_event_key=${tag} order by id`;
  assert.equal(rows.length,2);
  assert.equal(rows[0].verification,'DECLARED_SOURCE');
  assert.equal(rows[0].raw_stats.yards,12);
 });
 await test('V209 shared per-feed scoreboard cooldown blocks parallel requests',async()=>{
  const feed='fixture-'+tag;
  await sql`insert into public.edgeforce_sports_outcome_sync_v209(source,feed_id)
   values('fixture-score',${feed}) on conflict do nothing`;
  const acquire=()=>sql.begin(async tx=>{
   const rows=await tx`update public.edgeforce_sports_outcome_sync_v209
    set next_allowed_at=clock_timestamp()+interval '10 minutes',
     attempted_batches=attempted_batches+1,last_attempt_at=clock_timestamp()
    where source='fixture-score' and feed_id=${feed} and next_allowed_at<=clock_timestamp()
    returning next_allowed_at`;
   return rows.length===1;
  });
  const calls=await Promise.all([acquire(),acquire(),acquire()]);
  assert.equal(calls.filter(Boolean).length,1);
  const rows=await sql`select attempted_batches from public.edgeforce_sports_outcome_sync_v209
   where source='fixture-score' and feed_id=${feed}`;
  assert.equal(Number(rows[0].attempted_batches),1);
 });
}finally{
 await sql`delete from public.edgeforce_sports_plays_v209 where source_event_key=${tag}`;
 await sql`delete from public.edgeforce_sports_outcomes_v209 where source_event_key=${tag}`;
 await sql`delete from public.edgeforce_sports_outcome_sync_v209 where feed_id=${'fixture-'+tag}`;
 await sql.end({timeout:5});
}
