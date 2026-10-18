// Read-only migration readiness audit. Neither migrates data nor authorizes cutover.
type Db={prepare(sql:string):{all<T>():Promise<{results:T[]}>}};
type Env={INTELLIGENCE_DB?:Db;CRON_SECRET?:string};
const required=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'] as const;
export async function d1CutoverAudit(env:Env){
 if(!env.INTELLIGENCE_DB)return {ok:false,reason:'D1_BINDING_MISSING',cutoverAuthorized:false};
 const db=env.INTELLIGENCE_DB;
 const inventory=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all<{name:string}>();
 const names=new Set((inventory.results||[]).map(row=>row.name));
 const results: {name:string;present:boolean;count:number|null;error?:string}[]=[];
 for(const name of required){
  if(!names.has(name)){results.push({name,present:false,count:null});continue;}
  try{
   // Names are hardcoded literals, never supplied by a caller.
   const counts=await db.prepare('SELECT COUNT(*) AS total FROM "'+name+'"').all<{total:number}>();
   const total=counts.results?.[0]?.total;
   results.push({name,present:true,count:Number.isSafeInteger(total)&&total>=0?total:null});
  }catch{results.push({name,present:true,count:null,error:'COUNT_UNAVAILABLE'});}
 }
 const missing=results.filter(row=>!row.present).map(row=>row.name);
 const empty=results.filter(row=>row.present&&row.count===0).map(row=>row.name);
 const unreadable=results.filter(row=>row.present&&row.count===null).map(row=>row.name);
 const populated=missing.length===0&&empty.length===0&&unreadable.length===0;
 return {ok:true,checkedAt:new Date().toISOString(),mode:'READ_ONLY',requiredTableCount:required.length,missing,empty,unreadable,
  populated,sourceReconciliationVerified:false,backupRestoreVerified:false,appPersistenceContractsVerified:false,
  cutoverAuthorized:false,counts:results};
}
export async function d1CutoverAuditRoute(request:Request,env:Env){
 if(request.method!=='GET')return Response.json({ok:false,reason:'METHOD_NOT_ALLOWED'},{status:405});
 if(!env.CRON_SECRET||env.CRON_SECRET.length<32||request.headers.get('Authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401});
 try{return Response.json(await d1CutoverAudit(env),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({ok:false,cutoverAuthorized:false,reason:'AUDIT_UNAVAILABLE'},{status:503});}
}
