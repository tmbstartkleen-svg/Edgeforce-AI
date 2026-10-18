// Read-only backup prerequisite audit. Must not be treated as proof of restore.
type DB={prepare(sql:string):{all<T>():Promise<{results:T[]}>}};
type Env={INTELLIGENCE_DB?:DB;CRON_SECRET?:string};
const required=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'];
export async function assessBackupReadiness(env:Env){
 if(!env.INTELLIGENCE_DB)return {ok:false,reason:'D1_BINDING_MISSING',restoreCertified:false};
 const found=await env.INTELLIGENCE_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all<{name:string}>();
 const names=new Set((found.results||[]).map(x=>x.name));
 const missing=required.filter(x=>!names.has(x));
 const counts=[];
 for(const table of required){
  if(!names.has(table))continue;
  try{const q=await env.INTELLIGENCE_DB.prepare('SELECT COUNT(*) AS count FROM "'+table+'"').all<{count:number}>();
   counts.push({table,count:q.results?.[0]?.count??null});
  }catch{counts.push({table,count:null});}
 }
 return {ok:missing.length===0,mode:'READ_ONLY',requiredTables:required.length,missing,counts,
  verifiedSourceExport:false,backupArtifactCreated:false,isolatedRestorePerformed:false,
  restoreCertified:false,postgresMigrationComplete:false,productionCutoverAuthorized:false};
}
export async function backupReadinessRoute(request:Request,env:Env){
 if(request.method!=='GET')return Response.json({ok:false,reason:'METHOD_NOT_ALLOWED'},{status:405});
 if(!env.CRON_SECRET||env.CRON_SECRET.length<32||
 request.headers.get('Authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401});
 try{return Response.json(await assessBackupReadiness(env),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({ok:false,reason:'BACKUP_AUDIT_UNAVAILABLE',restoreCertified:false},{status:503});}
}
