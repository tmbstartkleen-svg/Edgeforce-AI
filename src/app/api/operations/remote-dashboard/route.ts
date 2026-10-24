import {db} from '@/lib/db';
import {configuredProviders} from '@/lib/providers/config';
import {RELEASE} from '@/lib/releaseManifest';
export const dynamic='force-dynamic';
/** Owner-authenticated dashboard snapshot: database-only, no provider polling or ingestion. */
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 const headers={'Cache-Control':'private, no-store, max-age=0'};
 if(!secret)return Response.json({ok:false,error:'NOT_CONFIGURED'},{status:503,headers});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,error:'UNAUTHORIZED'},{status:401,headers});
 const providers=configuredProviders('ODDS').map(p=>({id:p.id,name:p.name,bookmaker:p.bookmaker||p.name,enabled:p.enabled,credentialConfigured:Boolean(p.apiKey)}));
 const sql=db();
 if(!sql)return Response.json({ok:true,status:'BLOCKED',reason:'DATABASE_UNAVAILABLE',build:RELEASE.build,providers,marketSummary:[],
  summary:{total:0,recent:0,draftKingsRecent:0,independentProvidersRecent:0},
  agentSummary:[],readOnly:true,oddsApiCalls:0},{headers});
 try{
  const [counts,marketSummary,agentSummary]=await Promise.all([
   sql`select count(*)::int as total,
    count(*) filter(where pulled_at>=now()-interval '20 minutes')::int as recent,
    count(*) filter(where lower(bookmaker)='draftkings' and pulled_at>=now()-interval '20 minutes')::int as draftkings_recent,
    count(distinct provider) filter(where pulled_at>=now()-interval '20 minutes')::int as independent_providers_recent,
    max(pulled_at) as most_recent_at from market_snapshots`,
   sql`select e.sport,ms.bookmaker,ms.provider,count(*)::int as quote_count,
     max(ms.pulled_at) as most_recent_at
     from market_snapshots ms join events e on e.id=ms.event_id
     where ms.pulled_at>=now()-interval '24 hours'
     group by e.sport,ms.bookmaker,ms.provider
     order by quote_count desc limit 100`,
   sql`select agent_id,status,count(*)::int as count,max(scheduled_at) as most_recent_at
     from intelligence_agent_runs where scheduled_at>=now()-interval '7 days'
     group by agent_id,status order by agent_id,status limit 100`
  ]);
  const row=counts[0]||{};
  const summary={total:Number(row.total||0),recent:Number(row.recent||0),draftKingsRecent:Number(row.draftkings_recent||0),
   independentProvidersRecent:Number(row.independent_providers_recent||0),mostRecentAt:row.most_recent_at||null};
  const blockers=[];
  if(!summary.recent)blockers.push('NO_RECENT_STORED_ODDS');
  if(!summary.draftKingsRecent)blockers.push('NO_RECENT_DRAFTKINGS_QUOTES');
  if(summary.independentProvidersRecent<2)blockers.push('MULTIPLE_INDEPENDENT_UPSTREAMS_NOT_ESTABLISHED');
  const status=blockers.length?'DEGRADED':'UNVERIFIED_SOURCE_AUTHENTICITY';
  return Response.json({ok:true,status,blockers,generatedAt:new Date().toISOString(),build:RELEASE.build,
   providers,marketSummary,agentSummary,summary,readOnly:true,oddsApiCalls:0,
   independentUpstreamsCertified:false,fullDraftKingsCatalogCertified:false,modelsCalibratedCertified:false,
   notes:['Provider count reflects configured/provider-labeled data, not independently verified operators.',
    'Database insertion freshness does not independently certify original quote age.','No third-party API requests are made by this dashboard.']},{headers});
 }catch{return Response.json({ok:false,status:'BLOCKED',error:'DASHBOARD_DATABASE_READ_FAILED',readOnly:true,oddsApiCalls:0},{status:503,headers})}
}
