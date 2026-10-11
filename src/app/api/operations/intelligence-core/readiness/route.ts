import {db} from '@/lib/db';
import {evaluateIntelligenceReadiness} from '@/lib/intelligence-core/readiness-evaluator.mjs';
export const dynamic='force-dynamic';

/** Private, read-only readiness gate. Does not trigger collectors or migrations. */
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return Response.json({ok:false,reason:'NOT_CONFIGURED'},{status:503});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401});
 const sql=db();
 if(!sql)return Response.json({ok:false,reason:'DATABASE_UNAVAILABLE'},{status:503});
 try{
  const tables=await sql`
   select
    to_regclass('public.intelligence_sources') is not null as sources,
    to_regclass('public.intelligence_observations') is not null as observations,
    to_regclass('public.intelligence_agent_runs') is not null as runs,
    to_regclass('public.intelligence_model_forecasts') is not null as forecasts
  `;
  const available=Object.values(tables[0]??{}).every(Boolean);
  if(!available)return Response.json({ok:false,reason:'MIGRATION_REQUIRED',
   schema:tables[0],activation:'BLOCKED'},{status:503,headers:{'Cache-Control':'no-store'}});
  const [providers,agents,observations,runStats]=await Promise.all([
   sql`select count(*)::int as count from intelligence_sources where enabled=true`,
   sql`select status,count(*)::int as count from intelligence_agent_runs group by status`,
   sql`select max(observed_at) as latest,max(ingested_at) as last_ingested,\n       count(*)::int as count from intelligence_observations`,
   sql`select max(finished_at) filter(where status='SUCCEEDED') as last_success,
       count(*) filter(where status='FAILED' and finished_at>now()-interval '1 day')::int as failed_runs,
       count(*) filter(where status='RUNNING' and lease_until<now())::int as stuck_runs
       from intelligence_agent_runs`
  ]);
  const evidence=evaluateIntelligenceReadiness({
   schemaReady:available,approvedProviders:Number(providers[0]?.count??0),
   observationCount:Number(observations[0]?.count??0),
   latestObservationMs:observations[0]?.latest?new Date(observations[0].latest).getTime():null,
   lastSuccessfulRunMs:runStats[0]?.last_success?new Date(runStats[0].last_success).getTime():null,
   failedRuns:Number(runStats[0]?.failed_runs??0),stuckRuns:Number(runStats[0]?.stuck_runs??0),
   coreEnabled:process.env.INTELLIGENCE_CORE_ENABLED==='true',
   mirrorEnabled:process.env.INTELLIGENCE_WAREHOUSE_MIRROR_ENABLED==='true',
   now:Date.now()
  });
  return Response.json({
   ok:evidence.activationAllowed,
   ...evidence,
   schema:tables[0],
   enabledProviders:Number(providers[0]?.count??0),
   storedObservations:Number(observations[0]?.count??0),
   latestObservation:observations[0]?.latest??null,
   latestIngestion:observations[0]?.last_ingested??null,
   agentRuns:agents.map(x=>({status:x.status,count:Number(x.count)}))
  },{status:evidence.activationAllowed?200:503,headers:{'Cache-Control':'no-store'}});

 }catch{
  return Response.json({ok:false,reason:'READINESS_QUERY_FAILED',activation:'BLOCKED'},
   {status:503,headers:{'Cache-Control':'no-store'}});
 }
}
