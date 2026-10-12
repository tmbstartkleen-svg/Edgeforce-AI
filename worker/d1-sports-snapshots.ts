/** Authorized, bounded sports snapshot reads from Cloudflare D1. */
type DB={prepare(query:string):{bind(...args:unknown[]):{all():Promise<{results:unknown[]}>}}};
type Env={CRON_SECRET?:unknown;INTELLIGENCE_DB?:unknown};
export async function d1SportsSnapshots(request:Request,env:Env):Promise<Response>{
 const headers={'Cache-Control':'no-store'};
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||!env.CRON_SECRET||
 request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 const db=env.INTELLIGENCE_DB as DB|undefined;
 if(!db||typeof db.prepare!=='function')
  return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 const raw=new URL(request.url).searchParams.get('limit')??'25';
 if(!/^\d{1,3}$/.test(raw)||Number(raw)<1||Number(raw)>100)
  return Response.json({ok:false,reason:'INVALID_LIMIT'},{status:400,headers});
 try{
  const data=await db.prepare(`SELECT source_id,upstream_id,source_event_id,sport,league,home_team,away_team,
   start_time,market_key,selection_key,bookmaker,american_odds,source_observed_at,ingested_at,payload_sha256
   FROM sports_market_snapshots ORDER BY source_observed_at DESC LIMIT ?`)
   .bind(Number(raw)).all();
  return Response.json({ok:true,source:'D1',kind:'SPORTS_MARKETS',count:data.results.length,
    records:data.results,sourceCoverageCertified:false,neonHistoricalRecordsMigrated:false},{headers});
 }catch{
  return Response.json({ok:false,reason:'D1_SPORTS_READ_FAILED'},{status:503,headers});
 }
}
