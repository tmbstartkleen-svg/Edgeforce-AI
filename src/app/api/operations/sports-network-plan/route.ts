import {planSportsNetwork,auditMarketObservations,evaluateVerifiedEdge} from '@/lib/intelligence-core/sports-network-engine.mjs';
export const dynamic='force-dynamic';
/** Owner-only what-if preview. It NEVER runs crawlers, provider requests, or database writes. */
export async function POST(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return Response.json({ok:false,error:'NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,error:'UNAUTHORIZED'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{
  const body=await request.json();
  if(!body||typeof body!=='object'||Array.isArray(body))throw Error('INVALID_INPUT');
  const plan=planSportsNetwork({sources:Array.isArray(body.sources)?body.sources.slice(0,100):[],
   sports:Array.isArray(body.sports)?body.sports.slice(0,30):undefined,
   lanes:Array.isArray(body.lanes)?body.lanes.slice(0,20):undefined,
   budgetCredits:body.budgetCredits??0,maxJobs:body.maxJobs??20,now:Date.now()});
  const audit=Array.isArray(body.observations)?auditMarketObservations(body.observations.slice(0,5000)):null;
  const candidate=body.candidate?evaluateVerifiedEdge(body.candidate):null;
  return Response.json({ok:true,mode:'READ_ONLY_AGENT_NETWORK_PREVIEW',plan,audit,candidate,
   agentExecutionStarted:false,externalRequests:0,databaseWrites:0},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({ok:false,error:'INVALID_NETWORK_PLAN',agentExecutionStarted:false},{status:400,headers:{'Cache-Control':'no-store'}})}
}
