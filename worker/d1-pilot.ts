/** Optional Cloudflare D1 pilot; isolated from the existing PostgreSQL runtime.
 * Never writes data or invokes ingestion/cron. Only confirms bound schema.
 */
export type D1PilotDatabase = {
 prepare(query:string): {first<T=unknown>():Promise<T|null>};
};
export async function d1PilotReadiness(
 request:Request, env:{CRON_SECRET?:unknown;INTELLIGENCE_DB?:unknown}
):Promise<Response>{
 const headers={'Cache-Control':'no-store'};
 const secret=typeof env.CRON_SECRET==='string'?env.CRON_SECRET:'';
 if(!secret)return Response.json({ok:false,reason:'AUTH_NOT_CONFIGURED'},{status:503,headers});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 const db=env.INTELLIGENCE_DB as D1PilotDatabase|undefined;
 if(!db||typeof db.prepare!=='function')
  return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 try{
  const row=await db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name IN ('intelligence_sources','intelligence_observations')").first<{count:number}>();
  const ready=Number(row?.count)===2;
  return Response.json({ok:ready,mode:'D1_PILOT',schemaReady:ready,postgresUntouched:true},{status:ready?200:503,headers});
 }catch{
  return Response.json({ok:false,reason:'D1_READINESS_FAILED'},{status:503,headers});
 }
}
