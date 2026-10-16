/** Read-only inventory of the baseline D1 sports schema; never authorizes cutover. */
const required=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'] as const;
type DB={prepare(sql:string):{all<T>():Promise<{results:T[]}>}};
type Env={CRON_SECRET?:string;INTELLIGENCE_DB?:DB};
export async function d1SportsSchemaCoverage(request:Request,env:Env):Promise<Response>{
 const headers={'Cache-Control':'no-store'};
 const secret=typeof env.CRON_SECRET==='string'?env.CRON_SECRET:'';
 if(!secret)return Response.json({ok:false,reason:'AUTH_NOT_CONFIGURED'},{status:503,headers});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 if(request.method!=='GET')return Response.json({ok:false,reason:'METHOD_NOT_ALLOWED'},{status:405,headers:{...headers,Allow:'GET'}});
 if(!env.INTELLIGENCE_DB||typeof env.INTELLIGENCE_DB.prepare!=='function')return Response.json({ok:false,reason:'D1_UNAVAILABLE'},{status:503,headers});
 try{
  const result=await env.INTELLIGENCE_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all<{name:string}>();
  const existing=new Set(result.results.map(r=>r.name));
  const missing=required.filter(name=>!existing.has(name));
  return Response.json({ok:true,source:'D1_PILOT_SCHEMA_READ',baselineTablesRequired:required.length,baselineTablesPresent:required.length-missing.length,missing,baselineSchemaComplete:missing.length===0,productionPrimary:false,historyMigrated:false,queryParityCertified:false},{headers});
 }catch{return Response.json({ok:false,reason:'D1_SCHEMA_INSPECTION_FAILED'},{status:503,headers});}
}
