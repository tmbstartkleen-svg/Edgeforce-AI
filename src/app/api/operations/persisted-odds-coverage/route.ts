import {db} from '@/lib/db';
export const dynamic='force-dynamic';

/** Authenticated read-only audit of persisted sportsbook quotes. Does not trigger ingestion. */
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return Response.json({ok:false,reason:'NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers:{'Cache-Control':'no-store'}});
 const sql=db();
 if(!sql)return Response.json({ok:false,reason:'DATABASE_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});
 try{
  const [summary,books,sports]=await Promise.all([
   sql`select count(*)::int as total,
       count(*) filter(where pulled_at>=now()-interval '5 minutes')::int as fresh_5m,
       count(*) filter(where pulled_at>=now()-interval '20 minutes')::int as fresh_20m,
       count(*) filter(where lower(coalesce(bookmaker,''))='draftkings' and pulled_at>=now()-interval '20 minutes')::int as draftkings_fresh_20m,
       max(pulled_at) as latest_quote_at,
       count(distinct provider) as provider_count,
       count(distinct bookmaker) as bookmaker_count
     from market_snapshots`,
   sql`select coalesce(bookmaker,'UNKNOWN') as bookmaker,coalesce(provider,'UNKNOWN') as provider,
       count(*)::int as quotes,max(pulled_at) as latest_quote_at,
       count(*) filter(where pulled_at>=now()-interval '20 minutes')::int as fresh_20m
     from market_snapshots group by 1,2 order by max(pulled_at) desc limit 50`,
   sql`select coalesce(e.sport,'UNKNOWN') as sport,count(*)::int as quotes,
       count(*) filter(where ms.pulled_at>=now()-interval '20 minutes')::int as fresh_20m
     from market_snapshots ms join events e on e.id=ms.event_id
     group by 1 order by count(*) desc limit 100`
  ]);
  const s=summary[0]||{};
  return Response.json({ok:true,mode:'READ_ONLY_PERSISTED_ODDS_AUDIT',generatedAt:new Date().toISOString(),summary:s,bookmakerProviderInventory:books,sportInventory:sports,diagnosis:{draftKingsFreshQuotes:Number(s.draftkings_fresh_20m||0)>0,anyFreshQuotes:Number(s.fresh_20m||0)>0,independentUpstreamsCertified:false,completeMarketCoverageCertified:false,liveIngestionTriggered:false,externalApiRequestsMade:0},limitations:['This reports only quotes already persisted in the application database.','Distinct provider names do not establish independent upstream ownership.','A recent database timestamp alone does not certify provider source timestamps or complete DraftKings market coverage.']},{headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch{return Response.json({ok:false,reason:'AUDIT_QUERY_FAILED',liveIngestionTriggered:false},{status:503,headers:{'Cache-Control':'no-store'}})}
}
