import type {D1Database} from './d1-observations';
type Env={CRON_SECRET?:string;INTELLIGENCE_DB?:D1Database};
const headers={'Cache-Control':'no-store'};
/** Authenticated bounded readback of durable scheduler receipts; never executes collection. */
export async function scoreSchedulerReceipts(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||env.CRON_SECRET.length<24||request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 if(!env.INTELLIGENCE_DB?.prepare)return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 const limitText=new URL(request.url).searchParams.get('limit')||'40',limit=Number(limitText);
 if(!Number.isInteger(limit)||limit<1||limit>100)return Response.json({ok:false,reason:'INVALID_LIMIT'},{status:400,headers});
 try{
  const rows=await env.INTELLIGENCE_DB.prepare(`SELECT run_id,cohort,scheduled_at,sport,source_id,attempt_count,final_status,completed_at,persisted,outcome
   FROM score_scheduler_receipts ORDER BY scheduled_at DESC, sport ASC LIMIT ?`).bind(limit)
   .all<{run_id:string;cohort:number;scheduled_at:string;sport:string;source_id:string;attempt_count:number;final_status:number|null;completed_at:string|null;persisted:number;outcome:string}>();
  return Response.json({ok:true,mode:'READ_ONLY_SCHEDULER_RECEIPTS',count:rows.results.length,
   persisted:rows.results.filter(x=>x.persisted===1).length,failed:rows.results.filter(x=>x.outcome==='FAILED').length,
   receipts:rows.results,collectionTriggered:false,writesPerformedByEndpoint:0},{headers});
 }catch{return Response.json({ok:false,reason:'RECEIPTS_NOT_INITIALIZED_OR_READ_FAILED'},{status:503,headers});}
}
