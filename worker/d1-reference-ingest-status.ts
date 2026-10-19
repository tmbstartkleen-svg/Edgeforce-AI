/** Read-only safety diagnosis for the D1 reference ingestion pilot. Never reveals secrets. */
type Env={INGEST_SECRET?:unknown;INTELLIGENCE_DB?:unknown;D1_REFERENCE_INGEST_ENABLED?:unknown};
type Db={prepare(sql:string):{first<T>():Promise<T|null>}};
export async function d1ReferenceIngestStatus(request:Request,env:Env):Promise<Response>{
 const headers={'Cache-Control':'no-store'};
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 const secret=env.INGEST_SECRET;
 if(typeof secret!=='string'||!secret)return Response.json({ok:false,reason:'INGEST_AUTH_NOT_CONFIGURED'},{status:503,headers});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 const db=env.INTELLIGENCE_DB as Db|undefined;
 if(!db||typeof db.prepare!=='function')return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 try{
  const rows=await Promise.all(['teams','athletes','events'].map(async table=>{
   const count=await db.prepare('SELECT COUNT(*) AS count FROM "'+table+'"').first<{count:number}>();
   return {table,count:Number(count?.count??0)};
  }));
  const columns=await db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('events') WHERE name IN ('source','observed_at')").first<{count:number}>();
  const migrationReady=Number(columns?.count??0)===2;
  return Response.json({ok:migrationReady,kind:'D1_REFERENCE_INGEST_STATUS',enabled:env.D1_REFERENCE_INGEST_ENABLED==='true',migrationReady,rows,productionCutoverAuthorized:false},{status:migrationReady?200:503,headers});
 }catch{return Response.json({ok:false,reason:'D1_REFERENCE_STATUS_FAILED',productionCutoverAuthorized:false},{status:503,headers})}
}
