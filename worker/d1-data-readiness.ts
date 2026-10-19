/** Authenticated read-only D1 data readiness. Never authorizes application cutover. */
type Env={CRON_SECRET?:unknown;INTELLIGENCE_DB?:unknown};
const tables=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'] as const;
type Db={prepare(sql:string):{first<T>():Promise<T|null>}};
export async function d1DataReadiness(request:Request,env:Env):Promise<Response>{
 const headers={'Cache-Control':'no-store'};
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||!env.CRON_SECRET)return Response.json({ok:false,reason:'AUTH_NOT_CONFIGURED'},{status:503,headers});
 if(request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 const db=env.INTELLIGENCE_DB as Db|undefined;
 if(!db||typeof db.prepare!=='function')return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 try{
  const rows=await Promise.all(tables.map(async table=>{
   const present=await db.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='"+table+"'").first<{present:number}>();
   if(!present)return {table,present:false,count:null};
   const result=await db.prepare('SELECT COUNT(*) AS count FROM "'+table+'"').first<{count:number}>();
   return {table,present:true,count:Number(result?.count??0)};
  }));
  const missing=rows.filter(x=>!x.present).map(x=>x.table);
  const empty=rows.filter(x=>x.present&&x.count===0).map(x=>x.table);
  return Response.json({ok:missing.length===0&&empty.length===0,kind:'D1_PRIMARY_DATA_READINESS',rows,missingTables:missing,emptyTables:empty,sourceReconciliationVerified:false,appPersistenceContractsVerified:false,productionCutoverAuthorized:false},{status:missing.length||empty.length?503:200,headers});
 }catch{return Response.json({ok:false,reason:'D1_DATA_READINESS_FAILED',productionCutoverAuthorized:false},{status:503,headers});}
}
