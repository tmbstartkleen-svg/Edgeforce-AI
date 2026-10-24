import {appendD1Observations,readD1RecentObservations,type D1Database,type D1Observation} from './d1-observations';

type D1GatewayEnv={
 CRON_SECRET?:unknown;INGEST_SECRET?:unknown;INTELLIGENCE_D1_WRITE_ENABLED?:unknown;INTELLIGENCE_DB?:unknown;
};
const noStore={'Cache-Control':'no-store'};
const reply=(body:unknown,status:number)=>Response.json(body,{status,headers:noStore});
function authorized(request:Request,secret:unknown){
 return typeof secret==='string' && secret.length>0 && request.headers.get('authorization')===`Bearer ${secret}`;
}
export async function d1IngestGateway(request:Request,env:D1GatewayEnv):Promise<Response>{
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
 if(!authorized(request,env.INGEST_SECRET))return reply({ok:false,reason:'UNAUTHORIZED'},401);
 if(env.INTELLIGENCE_D1_WRITE_ENABLED!=='true')
  return reply({ok:false,reason:'D1_WRITE_DISABLED'},503);
 const db=env.INTELLIGENCE_DB as D1Database|undefined;
 if(!db||typeof db.prepare!=='function')return reply({ok:false,reason:'D1_BINDING_MISSING'},503);
 if(Number(request.headers.get('content-length')||0)>524288)return reply({ok:false,reason:'PAYLOAD_TOO_LARGE'},413);
 let items:unknown;
 try{
  const body=await request.text();
  if(new TextEncoder().encode(body).length>524288)return reply({ok:false,reason:'PAYLOAD_TOO_LARGE'},413);
  items=JSON.parse(body);
 }catch{return reply({ok:false,reason:'INVALID_JSON'},400);}
 if(!Array.isArray(items)||items.length>25)return reply({ok:false,reason:'INVALID_BATCH'},400);
 try{
  const report=await appendD1Observations(db,items as D1Observation[]);
  // Never acknowledge an all-rejected batch as a successful certification ingest.
  const persistedOrDeduplicated=report.accepted+report.duplicates;
  return reply({ok:persistedOrDeduplicated>0,...report},persistedOrDeduplicated>0?200:422);
 }catch{return reply({ok:false,reason:'D1_WRITE_FAILED'},503);}
}
export async function d1RecentGateway(request:Request,env:D1GatewayEnv):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 if(!authorized(request,env.CRON_SECRET))return reply({ok:false,reason:'UNAUTHORIZED'},401);
 const db=env.INTELLIGENCE_DB as D1Database|undefined;
 if(!db||typeof db.prepare!=='function')return reply({ok:false,reason:'D1_BINDING_MISSING'},503);
 try{
  const rows=await readD1RecentObservations(db,50);
  return reply({ok:true,source:'D1_PILOT',count:rows.length,observations:rows},200);
 }catch{return reply({ok:false,reason:'D1_READ_FAILED'},503);}
}
