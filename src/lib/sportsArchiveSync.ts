import {db} from '@/lib/db';

export type ArchiveKind='MARKET_OBSERVATION'|'MODEL_FORECAST'|'PLAYER_STAT';
export const ARCHIVE_KINDS=['MARKET_OBSERVATION','MODEL_FORECAST','PLAYER_STAT'] as const;
export type ArchiveSyncResult={
 kind:ArchiveKind;status:'COPIED'|'NO_NEW_RECORDS'|'COOLDOWN';
 scanned:number;inserted:number;cursor:number;nextAllowedAt:string;
};
/** Explicit license allowlist: no unapproved source gets copied into long-term storage. */
export function archiveAllowedSources(raw:string|undefined){
 return [...new Set((raw||'').split(',').map(x=>x.trim()).filter(x=>/^[A-Za-z0-9._-]{2,64}$/.test(x)))].slice(0,24);
}
export async function syncSportsArchive(kind:ArchiveKind,sourceAllowlist:string[]):Promise<ArchiveSyncResult>{
 if(!ARCHIVE_KINDS.includes(kind))throw new Error('INVALID_ARCHIVE_KIND');
 if((kind==='MARKET_OBSERVATION'||kind==='PLAYER_STAT')&&!sourceAllowlist.length)
  throw new Error('ARCHIVE_SOURCE_RIGHTS_NOT_CONFIGURED');
 const sql=db();
 if(!sql)throw new Error('ARCHIVE_DATABASE_NOT_CONFIGURED');
 // Exactly one up-to-80-record transaction per operator request; zero HTTP fanout.
 return sql.begin(async tx=>{
  // Row-level locks coordinate Cloudflare/Vercel operators using the same archive.
  const stateRows=await tx`
   select record_type,last_source_id,
    extract(epoch from clock_timestamp())*1000 as now_ms,
    extract(epoch from next_allowed_at)*1000 as next_ms
   from public.edgeforce_sports_archive_sync_v208
   where record_type=${kind} for update`;
  const state=stateRows[0];
  if(!state)throw new Error('ARCHIVE_MIGRATION_REQUIRED');
  const next=Number(state.next_ms),now=Number(state.now_ms);
  const cursor=Number(state.last_source_id);
  if(![next,now,cursor].every(Number.isFinite))throw new Error('ARCHIVE_CURSOR_INVALID');
  if(now<next){
   return {kind,status:'COOLDOWN' as const,scanned:0,inserted:0,cursor,
    nextAllowedAt:new Date(next).toISOString()};
  }
  type Batch={highest:string|null;scanned:string|number;inserted:string|number};
  let rows:Batch[]=[];
  if(kind==='MARKET_OBSERVATION'){
   rows=await tx<Batch[]>`
    with batch as (
     select ms.id,ms.event_id,ms.provider,ms.bookmaker,
      e.sport,e.league,e.start_time,ms.market_key,ms.selection_key,
      ms.american_odds,ms.pulled_at,
      nullif(ms.raw->>'sourceTimestamp','') as native_timestamp
     from market_snapshots ms
     join events e on e.id=ms.event_id
     where ms.id>${cursor} and ms.provider=any(${tx.array(sourceAllowlist)})
     order by ms.id asc limit 80
    ), inserted as (
     insert into public.edgeforce_sports_archive_v208 (
      record_type,source_record_id,source_provider,source_observed_at,
      event_id,event_time,sport,league,subject,data
     )
     select 'MARKET_OBSERVATION',id,provider,null,
      event_id,start_time,sport,league,selection_key,
      jsonb_build_object('bookmaker',bookmaker,'market',market_key,
       'selection',selection_key,'odds',american_odds,
       'sourceTimestamp',native_timestamp,'receivedAt',pulled_at)
     from batch where true on conflict(record_type,source_record_id) do nothing
     returning id
    )
    select (select max(id)::text from batch) as highest,
     (select count(*) from batch) as scanned,
     (select count(*) from inserted) as inserted
   `;
  }else if(kind==='MODEL_FORECAST'){
   rows=await tx<Batch[]>`
    with batch as (
     select mr.id,mr.event_id,mr.model_version,mr.market_key,mr.selection_key,
      mr.model_probability,mr.simulation_probability,mr.simulation_ci_low,
      mr.simulation_ci_high,mr.run_count,mr.created_at,
      e.sport,e.league,e.start_time
     from model_runs mr join events e on e.id=mr.event_id
     where mr.id>${cursor} order by mr.id asc limit 80
    ), inserted as (
     insert into public.edgeforce_sports_archive_v208(
      record_type,source_record_id,source_provider,source_observed_at,
      event_id,event_time,sport,league,subject,data
     )
     select 'MODEL_FORECAST',id,'EDGEFORCE_MODEL',created_at,
      event_id,start_time,sport,league,selection_key,
      jsonb_build_object('modelVersion',model_version,'market',market_key,
       'selection',selection_key,'modelProbability',model_probability,
       'simulationProbability',simulation_probability,'ciLow',simulation_ci_low,
       'ciHigh',simulation_ci_high,'runs',run_count)
     from batch where true on conflict(record_type,source_record_id) do nothing
     returning id
    )
    select (select max(id)::text from batch) as highest,
     (select count(*) from batch) as scanned,
     (select count(*) from inserted) as inserted
   `;
  }else{
   rows=await tx<Batch[]>`
    with batch as (
     select ps.id,ps.event_id,ps.athlete_id,ps.source,ps.stats,
      ps.stat_date,ps.imported_at,e.sport,e.league,e.start_time
     from player_game_stats ps join events e on e.id=ps.event_id
     where ps.id>${cursor} and ps.source=any(${tx.array(sourceAllowlist)})
     order by ps.id asc limit 80
    ), inserted as (
     insert into public.edgeforce_sports_archive_v208(
      record_type,source_record_id,source_provider,source_observed_at,
      event_id,event_time,sport,league,subject,data
     )
     select 'PLAYER_STAT',id,source,null,
      event_id,start_time,sport,league,athlete_id,
      jsonb_build_object('athleteId',athlete_id,'statDate',stat_date,
       'importedAt',imported_at,'stats',stats)
     from batch where true on conflict(record_type,source_record_id) do nothing
     returning id
    )
    select (select max(id)::text from batch) as highest,
     (select count(*) from batch) as scanned,
     (select count(*) from inserted) as inserted
   `;
  }
  const scanned=Number(rows[0]?.scanned||0),inserted=Number(rows[0]?.inserted||0);
  const highest=Number(rows[0]?.highest??cursor);
  if(![scanned,inserted,highest].every(Number.isFinite)||scanned>80||inserted>scanned)
   throw new Error('ARCHIVE_BATCH_INVALID');
  const [updated]=await tx`
   update public.edgeforce_sports_archive_sync_v208
    set last_source_id=${Math.max(cursor,highest)},
     attempted_batches=attempted_batches+1,
     copied_records=copied_records+${inserted},
     next_allowed_at=clock_timestamp()+interval '60 seconds',
     last_batch_at=clock_timestamp()
   where record_type=${kind}
   returning next_allowed_at`;
  return {kind,status:inserted>0?'COPIED': 'NO_NEW_RECORDS',
   scanned,inserted,cursor:Math.max(cursor,highest),
   nextAllowedAt:new Date(updated.next_allowed_at).toISOString()};
 });
}
