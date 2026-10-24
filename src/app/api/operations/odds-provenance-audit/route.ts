import {db} from '@/lib/db';
export const dynamic='force-dynamic';
/** Read-only provenance audit for stored odds. Never triggers provider polling or writes. */
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return Response.json({ok:false,reason:'NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers:{'Cache-Control':'no-store'}});
 const sql=db();if(!sql)return Response.json({ok:false,reason:'DATABASE_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});
 try{
  const [totals,inventory]=await Promise.all([
   sql`select count(*)::int as total,
    count(*) filter(where pulled_at>=now()-interval '20 minutes')::int as recent,
    count(*) filter(where lower(coalesce(bookmaker,''))='draftkings' and pulled_at>=now()-interval '20 minutes')::int as dk_recent,
    count(*) filter(where nullif(raw->>'sourceEventId','') is not null)::int as has_source_event,
    count(*) filter(where nullif(raw->>'sourceProviderId','') is not null)::int as has_source_provider,
    count(*) filter(where nullif(raw->>'sourceTimestamp','') is not null or nullif(raw->>'pulledAt','') is not null)::int as has_raw_source_time,
    count(distinct provider)::int as providers,count(distinct bookmaker)::int as books,max(pulled_at) as latest
    from market_snapshots`,
   sql`select coalesce(bookmaker,'UNKNOWN') as bookmaker,coalesce(provider,'UNKNOWN') as provider,count(*)::int as quotes,
    count(*) filter(where pulled_at>=now()-interval '20 minutes')::int as recent,
    count(*) filter(where nullif(raw->>'sourceEventId','') is not null and nullif(raw->>'sourceProviderId','') is not null)::int as provenance_fields_present,
    max(pulled_at) as latest from market_snapshots group by 1,2 order by max(pulled_at) desc limit 50`
  ]);
  const t=totals[0]||{};
  const result={total:Number(t.total||0),recent20m:Number(t.recent||0),draftKingsLabelledRecent20m:Number(t.dk_recent||0),withSourceEventId:Number(t.has_source_event||0),withSourceProviderId:Number(t.has_source_provider||0),withRawTimestampField:Number(t.has_raw_source_time||0),distinctProviderLabels:Number(t.providers||0),distinctBookmakerLabels:Number(t.books||0),latestPersistedAt:t.latest||null};
  const blockers=[];if(!result.recent20m)blockers.push('NO_RECENT_QUOTES');if(!result.draftKingsLabelledRecent20m)blockers.push('NO_RECENT_DRAFTKINGS_LABELLED_QUOTES');if(result.recent20m&&result.withSourceProviderId===0)blockers.push('RECENT_QUOTES_LACK_PROVIDER_PROVENANCE_FIELDS');
  return Response.json({ok:true,mode:'READ_ONLY_ODDS_PROVENANCE_AUDIT',generatedAt:new Date().toISOString(),summary:result,providerBookInventory:inventory,blockers,sourceAuthenticityVerified:false,independentUpstreamsVerified:0,completeMarketCoverageVerified:false,liveRequestsMade:0,writesPerformed:0,notes:['Presence of provenance fields is not independent proof of source authenticity.','Provider labels are not proof of distinct upstream ownership.','No external APIs were called and no ingestion was triggered.']},{headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch{return Response.json({ok:false,reason:'PROVENANCE_AUDIT_FAILED',liveRequestsMade:0,writesPerformed:0},{status:503,headers:{'Cache-Control':'no-store'}})}
}
