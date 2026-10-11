import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
const uri=process.env.IDENTITY_TEST_DATABASE_URL;
assert.ok(uri,'IDENTITY_TEST_DATABASE_URL missing');
const u=new URL(uri);
assert.ok(['localhost','127.0.0.1'].includes(u.hostname)&&
 u.pathname==='/edgeforce_snapshot_test','Do not connect production database');
const sql=postgres(uri,{max:4,prepare:false});
const nonce=randomUUID().slice(0,12),id='v210-fixture-'+nonce;
const source1='fixture-a-'+nonce,source1Alias='fixture-alias-'+nonce,source2='fixture-b-'+nonce;
const eventKey1='NFL:'+nonce,eventKeyAlias='NFL:alias'+nonce,eventKey2='NFL:other'+nonce;
const at='2026-10-09T20:00:00Z';
try{
 await sql.unsafe(readFileSync(new URL('../db/v209.sql',import.meta.url),'utf8'));
 await sql.unsafe(readFileSync(new URL('../db/v210.sql',import.meta.url),'utf8'));
 await test('V210 source registry starts empty and no provider is implicitly accepted',async()=>{
  const records=await sql`select * from public.edgeforce_score_sources_v210
   where source_id in (${source1},${source2},${source1Alias})`;
  assert.equal(records.length,0);
 });
 const register=(source,owner)=>sql`insert into public.edgeforce_score_sources_v210(
  source_id,upstream_owner,retention_reviewed,independent_source_enabled,review_reference,reviewed_at)
  values(${source},${owner},true,true,'fixture:reviewed-by-test',now())`;
 await register(source1,'provider-owner-'+nonce);
 await register(source1Alias,'provider-owner-'+nonce);
 await register(source2,'independent-owner-'+nonce);
 const outcome=async(source,key,home=21,away=14)=>sql`
  insert into public.edgeforce_sports_outcomes_v209(
   source,source_event_key,sport,league,home_name,away_name,scheduled_at,home_score,away_score)
  values(${source},${key},'NFL','NFL','Fixture Bills','Fixture Dolphins',
   ${at},${home},${away}) returning id`;
 const link=async(source,key)=>sql`
  insert into public.edgeforce_identity_links_v210(
   entity_type,canonical_id,source,source_entity_id,review_status,evidence)
  values('EVENT',${id},${source},${key},'NAME_AND_TIME_MATCHED','{}'::jsonb)`;
 await outcome(source1,eventKey1);await link(source1,eventKey1);
 await outcome(source1Alias,eventKeyAlias);await link(source1Alias,eventKeyAlias);
 await test('V210 one real owner behind two feed aliases cannot create independent consensus',async()=>{
  const [row]=await sql`select sources,evidence_status,distinct_scores
   from public.edgeforce_cross_source_finals_v210 where event_id=${id}`;
  assert.equal(row.sources,1);
  assert.equal(row.evidence_status,'SINGLE_SOURCE');
  assert.equal(row.distinct_scores,1);
 });
 await outcome(source2,eventKey2);await link(source2,eventKey2);
 await test('V210 two vetted upstream owners with identical latest scores agree',async()=>{
  const [row]=await sql`select sources,evidence_status,distinct_scores,home_score,away_score
   from public.edgeforce_cross_source_finals_v210 where event_id=${id}`;
  assert.equal(row.sources,2);
  assert.equal(row.evidence_status,'CROSS_SOURCE_AGREED');
  assert.equal(row.home_score,21);
  assert.equal(row.away_score,14);
 });
 await outcome(source2,eventKey2,24,14);
 await test('V210 later correction removes agreement without stale cached endorsements',async()=>{
  const [row]=await sql`select sources,evidence_status,distinct_scores
   from public.edgeforce_cross_source_finals_v210 where event_id=${id}`;
  assert.equal(row.evidence_status,'CONFLICTED');
  assert.equal(row.distinct_scores,2);
 });
 await outcome(source1,eventKey1,24,14);
 await outcome(source1Alias,eventKeyAlias,24,14);
 await test('V210 source correction restores agreement using newest source revision',async()=>{
  const [row]=await sql`select evidence_status,home_score,away_score
   from public.edgeforce_cross_source_finals_v210 where event_id=${id}`;
  assert.equal(row.evidence_status,'CROSS_SOURCE_AGREED');
  assert.equal(row.home_score,24);
 });
 await test('V210 unreviewed sources cannot be enabled as independent',async()=>{
  await assert.rejects(()=>sql`insert into public.edgeforce_score_sources_v210(
   source_id,upstream_owner,independent_source_enabled)
   values(${'unreviewed-'+nonce},'unreviewed-owner',true)`,err=>err.code==='23514');
 });
}finally{
 await sql`delete from public.edgeforce_identity_links_v210 where canonical_id=${id}`;
 await sql`delete from public.edgeforce_sports_outcomes_v209
  where source in (${source1},${source1Alias},${source2})`;
 await sql`delete from public.edgeforce_score_sources_v210
  where source_id in (${source1},${source1Alias},${source2})`;
 await sql.end({timeout:5});
}
