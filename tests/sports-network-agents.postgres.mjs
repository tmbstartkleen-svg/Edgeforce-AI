import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
const uri=process.env.AGENT_TEAM_TEST_DATABASE_URL;
assert.ok(uri,'AGENT_TEAM_TEST_DATABASE_URL required');
const u=new URL(uri);
assert.ok(['localhost','127.0.0.1'].includes(u.hostname)&&u.pathname==='/edgeforce_snapshot_test',
 'Agent integration tests must never connect to a real production database');
const sql=postgres(uri,{max:4,prepare:false});
const code=readFileSync(new URL('../src/lib/networkAgentTeam.ts',import.meta.url),'utf8');
const ts=createRequire(import.meta.url)('typescript');
const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(js.diagnostics?.length??0,0);
const cjs={exports:{}};
new Function('require','module','exports',js.outputText)(id=>{
 if(id==='node:crypto')return createRequire(import.meta.url)(id);
 if(id==='@/lib/db')return {db:()=>sql};
 if(id==='@/lib/sportRegistry')return {ESPN_SCOREBOARD_FEEDS:[]};
 if(id==='@/lib/gameSchedule')return {easternDay:()=>'',loadSchedule:()=>{throw Error('unapproved external call')}};
 throw Error('Unexpected dependency '+id);
},cjs,cjs.exports);
const team=cjs.exports;
const eventId='fixture-network-'+randomUUID().slice(0,8);
try{
 await sql.unsafe(readFileSync(new URL('../db/v211.sql',import.meta.url),'utf8'));
 await sql.unsafe('create table if not exists events(id text primary key,sport text not null,league text,start_time timestamptz not null)');
 await sql.unsafe("create table if not exists market_snapshots(id bigserial primary key,event_id text not null,provider text not null,bookmaker text not null,market_key text not null,selection_key text not null,american_odds integer not null,pulled_at timestamptz not null default now(),raw jsonb default '{}'::jsonb)");
 await sql`insert into events(id,sport,league,start_time)
  values(${eventId},'NFL','NFL',now()+interval '1 day')
  on conflict do nothing`;
 await sql`insert into market_snapshots(
  event_id,provider,bookmaker,market_key,selection_key,american_odds,raw)
 values(${eventId},'fixture-source','DraftKings','h2h','Fixture Bills',-115,
  ${sql.json({sourceTimestamp:new Date().toISOString()})})`;
 await sql`update public.edgeforce_network_agents_v211
  set enabled=(agent_id='market-watch'),next_due_at='epoch',lease_until='epoch',
   lease_token=null,last_result='NEVER_RUN'`;
 await test('V211 shared PostgreSQL claim prevents concurrent duplicate specialist work',async()=>{
  const [a,b]=await Promise.all([team.dispatchNetworkAgents(1),team.dispatchNetworkAgents(1)]);
  assert.equal(a.executedCount+b.executedCount,1);
  const [state]=await sql`select completed_runs,next_due_at,last_result,lease_token
   from public.edgeforce_network_agents_v211 where agent_id='market-watch'`;
  assert.equal(Number(state.completed_runs),1);
  assert.equal(state.lease_token,null);
  assert.equal(state.last_result,'EVIDENCE_FOUND');
  assert.ok(new Date(state.next_due_at).getTime()>Date.now());
  const [obs]=await sql`select source_role,source_ids,event_count,payload
   from public.edgeforce_network_agent_observations_v211
   where agent_id='market-watch' order by id desc limit 1`;
  assert.equal(obs.source_role,'STORED_FEED_DERIVED');
  assert.ok(obs.source_ids.includes('fixture-source'));
  assert.equal(obs.payload.executableQuotes,false);
 });
 await test('V211 unused league collector fails closed without explicit rights or HTTP requests',async()=>{
  const data=await team.collectNetworkAgent('score-scout');
  assert.equal(data.status,'NO_LICENSE');
  assert.equal(data.rowCount,0);
 });
 await test('V211 repeated dispatch honors next-due time',async()=>{
  const r=await team.dispatchNetworkAgents(2);
  assert.equal(r.executedCount,0);
 });
}finally{
 await sql`delete from public.edgeforce_network_agent_observations_v211
  where agent_id='market-watch'`;
 await sql`update public.edgeforce_network_agents_v211
  set enabled=true,completed_runs=0,last_result='NEVER_RUN',next_due_at='epoch',
   lease_until='epoch',lease_token=null,consecutive_failures=0,last_error=null,
   last_started_at=null,last_finished_at=null`;
 await sql`delete from market_snapshots where event_id=${eventId}`;
 await sql`delete from events where id=${eventId}`;
 await sql.end({timeout:5});
}
