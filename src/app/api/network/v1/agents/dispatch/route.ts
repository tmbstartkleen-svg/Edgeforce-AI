import {db} from '@/lib/db';
import {authorizeNetwork,networkHeaders} from '@/lib/firstPartySportsNetwork';
import {dispatchNetworkAgents} from '@/lib/networkAgentTeam';
export const dynamic='force-dynamic';
const fail=(status:string,code:number)=>Response.json({ok:false,status},{status:code,headers:networkHeaders});
export async function POST(request:Request){
 const auth=authorizeNetwork(request);if(auth)return auth;
 if(process.env.EDGEFORCE_AGENT_TEAM_ENABLED!=='true')return fail('AGENT_TEAM_DISABLED',503);
 if(Number(request.headers.get('content-length')||0)>96)return fail('REQUEST_TOO_LARGE',413);
 let count=2;
 try{
  const body=await request.text();
  if(body.length>96)throw Error('size');
  if(body){
   const data=JSON.parse(body) as unknown;
   if(!data||typeof data!=='object'||Array.isArray(data))throw Error('invalid');
   const max=(data as Record<string,unknown>).maxJobs;
   if(max!==undefined&&max!==1&&max!==2)throw Error('invalid');
   count=max===1?1:2;
  }
 }catch{return fail('INVALID_REQUEST',400)}
 try{
  const result=await dispatchNetworkAgents(count);
  return Response.json({ok:true,network:'EdgeForce Sports Network',version:'v211',
   ...result,scanningModel:'DURABLE_BOUNDED_SCHEDULED_SPECIALISTS',
   warning:'Most agents summarize permitted records already collected. Score Scout is the only optional new feed request. ChatGPT is an analyst, not a sportsbook or source of independently verified player injuries.'},
   {headers:networkHeaders});
 }catch{return fail('AGENT_DISPATCH_DATABASE_OR_MIGRATION_UNAVAILABLE',503)}
}
