import {db} from '@/lib/db';
import {authorizeNetwork,networkHeaders} from '@/lib/firstPartySportsNetwork';
import {ARCHIVE_KINDS,type ArchiveKind} from '@/lib/sportsArchiveSync';
export const dynamic='force-dynamic';
const fail=(status:string,code:number)=>Response.json({ok:false,status},{status:code,headers:networkHeaders});
type SyncRow={recordType:ArchiveKind;lastSourceId:string;attemptedBatches:string;copiedRecords:string;lastBatchAt:Date|string|null;nextAllowedAt:Date|string};
type RecordRow={id:string;recordType:ArchiveKind;sourceRecordId:string;sourceProvider:string;sourceObservedAt:Date|string|null;
 firstArchivedAt:Date|string;eventId:string;eventTime:Date|string;sport:string;league:string|null;subject:string;
 market:string|null;selection:string|null;bookmaker:string|null;odds:string|null;modelProbability:string|null;
 sourceTimestamp:string|null;statsArchived:boolean;
};
export async function GET(request:Request){
 const auth=authorizeNetwork(request);if(auth)return auth;
 const params=new URL(request.url).searchParams;
 const view=params.get('view')||'status';
 const kind=params.get('kind')||'MARKET_OBSERVATION';
 const sport=(params.get('sport')||'').trim();
 const before=params.get('before')||'9223372036854775807';
 const limit=params.get('limit')||'30';
 if(!['status','records'].includes(view)||!ARCHIVE_KINDS.includes(kind as ArchiveKind)||
  sport&&!/^[A-Za-z0-9 _-]{2,28}$/.test(sport)||
  !/^[1-9]\d{0,18}$/.test(before)||!Number.isFinite(Number(before))||
  !/^\d{1,2}$/.test(limit)||Number(limit)<1||Number(limit)>50)
  return fail('INVALID_ARCHIVE_QUERY',400);
 const sql=db();if(!sql)return fail('DATABASE_NOT_CONFIGURED',503);
 try{
  if(view==='status'){
   const rows=await sql<SyncRow[]>`
    select record_type as "recordType",last_source_id as "lastSourceId",
     attempted_batches as "attemptedBatches",copied_records as "copiedRecords",
     last_batch_at as "lastBatchAt",next_allowed_at as "nextAllowedAt"
    from public.edgeforce_sports_archive_sync_v208 order by record_type asc
   `;
   return Response.json({
    ok:true,network:'EdgeForce Sports Network',version:'v208',
    dataRole:'PRIVATE_ARCHIVE_STATUS',asOf:new Date().toISOString(),
    writesEnabled:process.env.EDGEFORCE_ARCHIVE_WRITES_ENABLED==='true',
    playerArchiveEnabled:process.env.EDGEFORCE_ARCHIVE_PLAYER_STATS_ENABLED==='true',
    sourceAllowlistConfigured:Boolean(process.env.EDGEFORCE_ARCHIVE_ALLOWED_PROVIDERS?.trim()),
    streams:rows.map(r=>({
     recordType:r.recordType,lastSourceId:r.lastSourceId,copiedRecords:r.copiedRecords,
     attemptedBatches:r.attemptedBatches,lastBatchAt:r.lastBatchAt,
     nextAllowedAt:r.nextAllowedAt
    })),
    warning:'Counts represent authorized historical rows copied to the private warehouse, not all games or officially verified outcomes.'
   },{headers:networkHeaders});
  }
  const records=await sql<RecordRow[]>`
   select id::text as id,record_type as "recordType",
    source_record_id::text as "sourceRecordId",source_provider as "sourceProvider",
    source_observed_at as "sourceObservedAt",first_archived_at as "firstArchivedAt",
    event_id as "eventId",event_time as "eventTime",sport,league,subject,
    data->>'market' as market,data->>'selection' as selection,
    data->>'bookmaker' as bookmaker,data->>'odds' as odds,
    data->>'modelProbability' as "modelProbability",
    data->>'sourceTimestamp' as "sourceTimestamp",
    (record_type='PLAYER_STAT') as "statsArchived"
   from public.edgeforce_sports_archive_v208
   where record_type=${kind} and (${sport}='' or lower(sport)=lower(${sport}))
    and id<${before}::bigint
   order by id desc limit ${Number(limit)}
  `;
  return Response.json({
   ok:true,network:'EdgeForce Sports Network',version:'v208',
   dataRole:'IMMUTABLE_RESEARCH_ARCHIVE',kind,asOf:new Date().toISOString(),
   records:records.map(x=>({
    ...x,sourceObservedAt:x.sourceObservedAt?new Date(x.sourceObservedAt).toISOString():null,
    firstArchivedAt:new Date(x.firstArchivedAt).toISOString(),eventTime:new Date(x.eventTime).toISOString(),
    quoteResearchOnly:true,officialScoreVerified:false,executionEligible:false
   })),
   nextBefore:records.length===Number(limit)?records[records.length-1].id:null,
   warning:'Private sourced history, not official outcomes or live executable prices. Archive availability depends on source rights, retention and ingestion.'
  },{headers:networkHeaders});
 }catch{return fail('ARCHIVE_DATABASE_OR_MIGRATION_UNAVAILABLE',503);}
}
