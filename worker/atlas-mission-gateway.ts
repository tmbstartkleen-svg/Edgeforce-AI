// Secure gateway between the Founder command surface and a private Cloudflare Durable Object.
// Access is verified BEFORE any odds-provider fetch or LLM request can run.
import type {AtlasJournalItem} from './atlas-mission-room';

type Stub={fetch(input:Request):Promise<Response>};
type Namespace={
 idFromName(name:string):unknown;
 get(id:unknown):Stub;
};
type Env={
 EDGEFORCE_NETWORK_OWNER_TOKEN?:unknown;
 ATLAS_MISSION_ROOM?:Namespace;
};
type Forward=(request:Request)=>Promise<Response>;
const noStore={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:noStore});

async function validToken(required:unknown,provided:string){
 if(typeof required!=='string'||required.length<24||!provided||provided.length>512)return false;
 const encoder=new TextEncoder();
 const hashes=await Promise.all([required,provided].map(x=>crypto.subtle.digest('SHA-256',encoder.encode(x))));
 const a=new Uint8Array(hashes[0]),b=new Uint8Array(hashes[1]);
 let diff=0;
 for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 return diff===0;
}
function room(env:Env):Stub|null{
 const binding=env.ATLAS_MISSION_ROOM;
 if(!binding||typeof binding.idFromName!=='function'||typeof binding.get!=='function')return null;
 return binding.get(binding.idFromName('founder-atlas-private-v1'));
}
const roomRequest=(path:string,method:'GET'|'POST',body?:unknown)=>new Request('https://atlas.internal'+path,{
 method,headers:body?{'Content-Type':'application/json'}:undefined,
 body:body===undefined?undefined:JSON.stringify(body)
});
export async function atlasGateway(request:Request,env:Env,forward:Forward):Promise<Response>{
 const url=new URL(request.url);
 const isHistory=url.pathname==='/api/network/missions';
 const isDirector=url.pathname==='/api/network/director';
 if(!isHistory&&!isDirector)return json({ok:false,error:'UNKNOWN_NETWORK_PATH'},404);
 if(isDirector&&request.method==='GET')return forward(request);
 if((isDirector&&request.method!=='POST')||(isHistory&&request.method!=='GET')){
  return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
 }
 const required=env.EDGEFORCE_NETWORK_OWNER_TOKEN;
 if(typeof required!=='string'||required.length<24)return json({
  ok:false,error:'OWNER_AUTH_NOT_CONFIGURED',message:'Configure the Founder token in Worker secrets.'
 },503);
 const bearer=request.headers.get('authorization')||'';
 const supplied=bearer.startsWith('Bearer ')?bearer.slice(7).trim():'';
 if(!await validToken(required,supplied))return json({ok:false,error:'UNAUTHORIZED'},401);
 const instance=room(env);
 if(!instance)return json({ok:false,error:'ATLAS_JOURNAL_UNAVAILABLE',
  message:'The durable mission room binding is missing. This endpoint will not claim persistent missions.'
 },503);

 if(isHistory){
  try{
   const limit=Math.min(30,Math.max(1,Number(url.searchParams.get('limit')||15)||15));
   const result=await instance.fetch(roomRequest('/history?limit='+limit,'GET'));
   if(!result.ok)return json({ok:false,error:'HISTORY_UNAVAILABLE'},503);
   return json(await result.json(),200);
  }catch{return json({ok:false,error:'HISTORY_UNAVAILABLE'},503);}
 }
 const length=Number(request.headers.get('content-length')||0);
 if(length>4096)return json({ok:false,error:'REQUEST_TOO_LARGE'},413);
 // Reserve capacity BEFORE dispatching multiple LLM calls.
 try{
  const reservation=await instance.fetch(roomRequest('/reserve','POST',{}));
  if(reservation.status===429)return json({ok:false,error:'MISSION_RATE_LIMIT',message:'Director mission quota reached. Try again after the cooldown.'},429);
  if(!reservation.ok)return json({ok:false,error:'MISSION_RESERVATION_FAILED'},503);
 }catch{return json({ok:false,error:'MISSION_RESERVATION_FAILED'},503);}
 try{
  const response=await forward(request);
  if(!response.ok)return response;
  const original=await response.json() as Record<string,unknown>;
  if(!original||original.ok!==true)return json({ok:false,error:'INVALID_DIRECTOR_REPORT'},503);
  const question=typeof original.question==='string'?original.question:'';
  if(!question||question.length>500)return json({ok:false,error:'INVALID_DIRECTOR_REPORT'},503);
  const id=crypto.randomUUID();
  const entry:AtlasJournalItem={
   id,createdAt:new Date().toISOString(),request:question,response:{...original,missionId:id,durable:true}
  };
  const saved=await instance.fetch(roomRequest('/missions','POST',entry));
  if(!saved.ok)return json({
   ok:false,error:'MISSION_PERSISTENCE_FAILED',
   message:'ATLAS completed the research but could not preserve its report. The result was withheld for integrity.'
  },503);
  return json({...original,missionId:id,durable:true,persisted:true});
 }catch{
  return json({ok:false,error:'ATLAS_GATEWAY_FAILED',message:'Director gateway failed. No completed mission was claimed.'},503);
 }
}
