import {db} from '@/lib/db';
export const dynamic='force-dynamic';

/** Authenticated provider provenance audit. Never inserts, registers or polls sources. */
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return Response.json({ok:false,reason:'NOT_CONFIGURED'},{status:503});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401});
 const sql=db();
 if(!sql)return Response.json({ok:false,reason:'DATABASE_UNAVAILABLE'},{status:503});
 try{
  const exists=await sql`select to_regclass('public.intelligence_sources') is not null as registered,
   to_regclass('public.intelligence_observations') is not null as observations`;
  if(!exists[0]?.registered||!exists[0]?.observations)
   return Response.json({ok:false,reason:'MIGRATION_REQUIRED'},{status:503,headers:{'Cache-Control':'no-store'}});
  const rows=await sql`
   select s.source_id,s.upstream_id,s.source_type,s.enabled,
          count(o.observation_id)::int as observation_count,
          max(o.observed_at) as newest_source_timestamp,
          max(o.ingested_at) as newest_ingestion_timestamp
   from intelligence_sources s
   left join intelligence_observations o on o.source_id=s.source_id and o.upstream_id=s.upstream_id
   group by s.source_id,s.upstream_id,s.source_type,s.enabled
   order by s.source_id limit 100
  `;
  const providers=rows.map(r=>{
   const observed=r.newest_source_timestamp?new Date(r.newest_source_timestamp).getTime():null;
   const ageMs=observed===null?null:Date.now()-observed;
   return {sourceId:String(r.source_id),upstreamId:String(r.upstream_id),
    sourceType:String(r.source_type),enabled:Boolean(r.enabled),
    observations:Number(r.observation_count),
    latestObservedAt:r.newest_source_timestamp??null,
    latestIngestedAt:r.newest_ingestion_timestamp??null,
    freshness:ageMs===null?'NO_DATA':ageMs<0?'INVALID_FUTURE_TIMESTAMP':ageMs<=300000?'FRESH':'STALE'
   };
  });
  const enabled=providers.filter(p=>p.enabled);
  const independentUpstreams=new Set(enabled.map(p=>p.upstreamId)).size;
  return Response.json({
   ok:true,mode:'READ_ONLY',providerCount:providers.length,
   enabledProviders:enabled.length,independentUpstreams,
   independentOddsUpstreams:new Set(enabled.filter(p=>p.sourceType==='sportsbook-odds').map(p=>p.upstreamId)).size,
   providers,
   note:'Independent upstream count is configuration-based, not verification of live quotes; bookmaker labels are not independent feeds.'
  },{headers:{'Cache-Control':'no-store'}});
 }catch{
  return Response.json({ok:false,reason:'PROVENANCE_AUDIT_FAILED'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
