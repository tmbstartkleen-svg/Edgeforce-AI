/** Read-only D1 schema inventory. Never enumerates table rows or changes storage. */
type D1Env={ [key:string]:unknown };
type SchemaRow={name:string};
const expected=['intelligence_sources','intelligence_observations','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'];
export async function d1SchemaInspection(request:Request,env:D1Env):Promise<Response>{
 const headers={'Cache-Control':'no-store'};
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 const secret=env.CRON_SECRET;
 if(typeof secret!=='string'||!secret)return Response.json({ok:false,reason:'AUTH_NOT_CONFIGURED'},{status:503,headers});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 const db=env.INTELLIGENCE_DB as {prepare(sql:string):{all<T>():Promise<{results:T[]}>}}|undefined;
 if(!db||typeof db.prepare!=='function')return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 try{
  const result=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name LIMIT 200").all<SchemaRow>();
  const existing=new Set((result.results||[]).map(x=>String(x.name)));
  const missing=expected.filter(x=>!existing.has(x));
  return Response.json({ok:missing.length===0,store:'d1',inspection:'read_only_schema',expectedTables:expected.length,presentTables:expected.filter(x=>existing.has(x)),missingTables:missing,applicationCutover:false},{status:missing.length?503:200,headers});
 }catch{return Response.json({ok:false,reason:'D1_SCHEMA_INSPECTION_FAILED',applicationCutover:false},{status:503,headers});}
}
