// Bounded, read-only D1 storage steward. No source deletions, migrations or writes.
// Any future automation must be explicitly enabled and separately certified.
type D1={prepare(sql:string):{first<T>():Promise<T|null>;all<T>():Promise<{results:T[]}>}};
type Env={INTELLIGENCE_DB?:D1;CRON_SECRET?:string};
const checks=[
 {table:'specialist_tasks',sql:"SELECT task_state AS status, count(*) AS total FROM specialist_tasks GROUP BY task_state"},
 {table:'sports_events',sql:"SELECT count(*) AS total FROM sports_events"},
 {table:'model_runs',sql:"SELECT count(*) AS total FROM model_runs"}
] as const;
const safeName=(s:string)=>/^[a-z_]+$/.test(s);
export async function inspectStorageSteward(env:Env){
 if(!env.INTELLIGENCE_DB)return {ok:false,mode:'READ_ONLY',reason:'D1_BINDING_MISSING',checks:[]};
 const db=env.INTELLIGENCE_DB;
 const inventory=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all<{name:string}>();
 const tables=new Set((inventory.results||[]).map(x=>x.name));
 const results=[];
 for(const check of checks){
  if(!safeName(check.table))continue;
  if(!tables.has(check.table)){results.push({table:check.table,status:'MISSING',rows:[]});continue;}
  try{
   const answer=await db.prepare(check.sql).all<Record<string,unknown>>();
   results.push({table:check.table,status:'AVAILABLE',rows:(answer.results||[]).slice(0,10)});
  }catch{results.push({table:check.table,status:'QUERY_FAILED',rows:[]});}
 }
 return {ok:true,mode:'READ_ONLY',reason:'PRODUCTION_NOT_SWITCHED',checkedAt:new Date().toISOString(),tableCount:tables.size,checks:results};
}
export async function storageStewardRoute(request:Request,env:Env){
 if(request.method!=='GET')return Response.json({ok:false,reason:'METHOD_NOT_ALLOWED'},{status:405});
 const expected=env.CRON_SECRET;
 if(!expected||expected.length<32||request.headers.get('Authorization')!==`Bearer ${expected}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401});
 try{return Response.json(await inspectStorageSteward(env),{headers:{'Cache-Control':'no-store'}})}
 catch{return Response.json({ok:false,mode:'READ_ONLY',reason:'STORAGE_CHECK_UNAVAILABLE'},{status:503})}
}
