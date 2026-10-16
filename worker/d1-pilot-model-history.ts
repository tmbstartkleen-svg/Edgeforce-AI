import {readModelRuns,type D1Database} from './d1-model-runs';
/** Protected pilot-only stored model history; not live inference. */
type Env={INTELLIGENCE_DB?:D1Database;CRON_SECRET?:string};
export async function d1PilotModelHistory(request:Request,env:Env):Promise<Response>{
 const headers={'Cache-Control':'no-store'};
 const secret=typeof env.CRON_SECRET==='string'?env.CRON_SECRET:'';
 if(!secret)return Response.json({ok:false,reason:'AUTH_NOT_CONFIGURED'},{status:503,headers});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 if(request.method!=='GET')return Response.json({ok:false,reason:'METHOD_NOT_ALLOWED'},{status:405,headers:{...headers,Allow:'GET'}});
 const url=new URL(request.url);
 const eventId=url.searchParams.get('event_id');
 if(!eventId||!eventId.trim()||eventId.length>256)return Response.json({ok:false,reason:'VALID_EVENT_ID_REQUIRED'},{status:400,headers});
 const param=url.searchParams.get('limit');
 if(param!==null&&!/^(?:[1-9]|[1-9][0-9]|100)$/.test(param))return Response.json({ok:false,reason:'INVALID_LIMIT'},{status:400,headers});
 if(!env.INTELLIGENCE_DB)return Response.json({ok:false,reason:'D1_UNAVAILABLE'},{status:503,headers});
 try{
  const rows=await readModelRuns(env.INTELLIGENCE_DB,eventId,param===null?25:Number(param));
  return Response.json({ok:true,source:'D1_PILOT_STORED_MODEL_HISTORY',event_id:eventId,rows,productionPrimary:false,isLiveInference:false},{headers});
 }catch{return Response.json({ok:false,reason:'D1_PILOT_MODEL_HISTORY_FAILED'},{status:503,headers});}
}
