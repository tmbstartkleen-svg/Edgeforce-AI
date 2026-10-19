/** Bounded, read-only D1 liveness test independent of the legacy PostgreSQL request scope. */
type D1HealthEnv={ [key:string]:unknown };
export async function d1RuntimeHealth(request:Request,env:D1HealthEnv):Promise<Response>{
 const headers={'Cache-Control':'no-store'};
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 const database=env.INTELLIGENCE_DB as {prepare(sql:string):{first<T>():Promise<T|null>}}|undefined;
 if(!database||typeof database.prepare!=='function')
  return Response.json({ok:false,store:'d1',reason:'D1_BINDING_MISSING'},{status:503,headers});
 try{
  const row=await database.prepare('SELECT 1 AS ok').first<{ok:number}>();
  if(Number(row?.ok)!==1)throw new Error('Unexpected query result');
  return Response.json({ok:true,store:'d1',probe:'SELECT_1',applicationCutover:false},{headers});
 }catch{
  return Response.json({ok:false,store:'d1',reason:'D1_QUERY_FAILED',applicationCutover:false},{status:503,headers});
 }
}
