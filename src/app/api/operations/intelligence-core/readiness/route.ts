import {db} from '@/lib/db';
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
  const [providers,agents,observations]=await Promise.all([
   sql`select count(*)::int as count from intelligence_sources where enabled=true`,
   sql`select status,count(*)::int as count from intelligence_agent_runs group by status`,
   sql`select max(ingested_at) as latest,count(*)::int as count from intelligence_observations`
  ]);
  const enabledProviders=Number(providers[0]?.count??0);
  const coreEnabled=process.env.INTELLIGENCE_CORE_ENABLED==='true';
  const ready=enabledProviders>0;
  return Response.json({
   ok:ready,activation:coreEnabled?'REQUESTED':'DISABLED',
   reason:ready?'READINESS_INSPECTED':'NO_APPROVED_PROVIDERS',
   schema:tables[0],enabledProviders,
   storedObservations:Number(observations[0]?.count??0),
   latestObservation:observations[0]?.latest??null,
   agentRuns:agents.map(x=>({status:x.status,count:Number(x.count)})),
   warning:'Readiness inspection is not proof of independent live price feeds or collector operations'
  },{status:ready?200:503,headers:{'Cache-Control':'no-store'}});
 }catch{
  return Response.json({ok:false,reason:'READINESS_QUERY_FAILED',activation:'BLOCKED'},
   {status:503,headers:{'Cache-Control':'no-store'}});
 }
}
