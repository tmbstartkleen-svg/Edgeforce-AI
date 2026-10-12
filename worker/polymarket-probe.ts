import {probePolymarketEvents} from '../src/lib/intelligence-core/polymarket-source.mjs';
type Env={CRON_SECRET?:unknown};
const headers={'Cache-Control':'no-store'};
export async function hostedPolymarketProbe(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||!env.CRON_SECRET||
 request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
 return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 const controller=new AbortController();
 const timeout=AbortSignal.timeout(8000);
 try{
  const result=await probePolymarketEvents({signal:timeout});
  // Do not expose contract titles through this diagnostic endpoint.
  return Response.json({ok:true,source:result.source,count:result.count,
   division:'UNCLASSIFIED',persisted:false,
   actualLiveUpstreamFetch:true,licenseValidated:false},{headers});
 }catch(e){
  return Response.json({ok:false,reason:'SOURCE_PROBE_FAILED',
   errorCode:e instanceof Error&&e.message.startsWith('POLYMARKET_')?e.message:'UPSTREAM_UNKNOWN'},
   {status:503,headers});
 }
}
