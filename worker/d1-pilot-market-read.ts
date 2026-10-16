import {getRecentMarketSnapshots,type D1Store} from './d1-market-snapshots';
/** Read-only, pilot-only market evidence. Never emits invented prices. */
type Env={INTELLIGENCE_DB?:D1Store};
export async function d1PilotMarketRead(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return Response.json({ok:false,reason:'METHOD_NOT_ALLOWED'},{status:405,headers:{Allow:'GET'}});
 const url=new URL(request.url);
 const eventId=url.searchParams.get('event_id');
 if(!eventId||eventId.length>256)return Response.json({ok:false,reason:'VALID_EVENT_ID_REQUIRED'},{status:400});
 const lim=url.searchParams.get('limit');
 if(lim!==null&&!/^(?:[1-9]|[1-9][0-9]|100)$/.test(lim))return Response.json({ok:false,reason:'INVALID_LIMIT'},{status:400});
 if(!env.INTELLIGENCE_DB)return Response.json({ok:false,reason:'D1_UNAVAILABLE'},{status:503});
 try{
  const rows=await getRecentMarketSnapshots(env.INTELLIGENCE_DB,eventId,lim===null?50:Number(lim));
  return Response.json({ok:true,source:'D1_PILOT_ONLY',event_id:eventId,rows,productionPrimary:false,independentOddsVerification:false},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({ok:false,reason:'D1_PILOT_READ_FAILED'},{status:503});}
}
