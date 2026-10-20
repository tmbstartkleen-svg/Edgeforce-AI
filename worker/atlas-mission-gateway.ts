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
 const isScheduleStatus=url.pathname==='/api/network/schedule/status';
 const isScheduleTask=url.pathname==='/api/network/schedule/task';
 const isScheduleLifecycle=url.pathname==='/api/network/schedule/lifecycle';
 const isScheduleCancel=url.pathname==='/api/network/schedule/cancel';
 const isHistory=url.pathname==='/api/network/missions';
 const isTasks=url.pathname==='/api/network/tasks';
 const isDirector=url.pathname==='/api/network/director';
 if(!isHistory&&!isTasks&&!isDirector&&!isScheduleStatus&&!isScheduleTask&&!isScheduleLifecycle&&!isScheduleCancel)return json({ok:false,error:'UNKNOWN_NETWORK_PATH'},404);
 if(isDirector&&request.method==='GET')return forward(request);
 if((isDirector&&request.method!=='POST')||((isHistory||isTasks||isScheduleStatus||isScheduleTask)&&request.method!=='GET')){
  return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
 }
 const required=env.EDGEFORCE_NETWORK_OWNER_TOKEN;
 if(typeof required!=='string'||required.length<24)return json({
  ok:false,error:'OWNER_AUTH_NOT_CONFIGURED',message:'Configure the Founder token in Worker secrets.'
 },503);
 const bearer=request.headers.get('authorization')||'';
 const supplied=bearer.startsWith('Bearer ')?bearer.slice(7).trim():'';
 if(!await validToken(required,supplied))return json({ok:false,error:'UNAUTHORIZED'},401);
 // Authenticated status and explicitly blocked lifecycle share the owner gate.
 if(isScheduleLifecycle)return json({ok:false,error:'SCHEDULER_DISABLED'},403);
 const instance=room(env);
 if(!instance)return json({ok:false,error:'ATLAS_JOURNAL_UNAVAILABLE',
  message:'The durable mission room binding is missing. This endpoint will not claim persistent missions.'
 },503);

 if(isScheduleCancel){
  if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const length=Number(request.headers.get('content-length')||0);
  if(length>1024)return json({ok:false,error:'REQUEST_TOO_LARGE'},413);
  let data:unknown;
  try{const raw=await request.text();if(raw.length>1024)return json({ok:false,error:'REQUEST_TOO_LARGE'},413);data=JSON.parse(raw);}
  catch{return json({ok:false,error:'INVALID_JSON'},400);}
  if(!data||typeof data!=='object'||Array.isArray(data))return json({ok:false,error:'INVALID_CANCEL'},400);
  const input=data as Record<string,unknown>;
  if(typeof input.id!=='string'||!/^[A-Za-z0-9-]{12,90}$/.test(input.id)||
   !['QUEUED','RETRY_WAIT','RUNNING'].includes(String(input.expectedState))||
   !Number.isSafeInteger(input.expectedAttempts)||Number(input.expectedAttempts)<0)
   return json({ok:false,error:'INVALID_CANCEL'},400);
  try{
   const reply=await instance.fetch(roomRequest('/schedule/cancel','POST',{
    id:input.id,expectedState:input.expectedState,expectedAttempts:input.expectedAttempts
   }));
   return json(await reply.json(),reply.status);
  }catch{return json({ok:false,error:'SCHEDULER_CANCEL_UNAVAILABLE'},503);}
 }
 if(isScheduleTask){
  const id=url.searchParams.get('id')||'';
  if(!/^[A-Za-z0-9-]{12,90}$/.test(id))return json({ok:false,error:'INVALID_TASK_ID'},400);
  try{
   const reply=await instance.fetch(roomRequest('/schedule/task?id='+encodeURIComponent(id),'GET'));
   return json(await reply.json(),reply.status);
  }catch{return json({ok:false,error:'SCHEDULER_TASK_UNAVAILABLE'},503);}
 }
 if(isScheduleStatus){
  try{
   const result=await instance.fetch(roomRequest('/schedule/status','GET'));
   if(!result.ok)return json({ok:false,error:'SCHEDULER_STATUS_UNAVAILABLE'},503);
   return json(await result.json());
  }catch{return json({ok:false,error:'SCHEDULER_STATUS_UNAVAILABLE'},503);}
 }
 if(isTasks){
  try{
   const agent=url.searchParams.get('agent')||'';
   if(agent&&!['atlas','mercury','vector','pulse','flash','sentinel','forge'].includes(agent))
    return json({ok:false,error:'UNKNOWN_DIRECTOR'},400);
   const args=new URLSearchParams({limit:'60'});
   if(agent)args.set('agent',agent);
   const reply=await instance.fetch(roomRequest('/tasks?'+args.toString(),'GET'));
   if(!reply.ok)return json({ok:false,error:'TASKS_UNAVAILABLE'},503);
   return json(await reply.json());
  }catch{return json({ok:false,error:'TASKS_UNAVAILABLE'},503);}
 }
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
 // Validate the request before charging the director's rate-limit budget.
 let question='';
 try{
  const parsed=await request.clone().json() as {question?:unknown};
  if(parsed&&typeof parsed.question==='string')question=parsed.question.trim();
 }catch{return json({ok:false,error:'INVALID_JSON'},400);}
 if(question.length<3||question.length>500)return json({ok:false,error:'INVALID_QUESTION'},400);
 // Reserve capacity BEFORE dispatching multiple LLM calls.
 try{
  const reservation=await instance.fetch(roomRequest('/reserve','POST',{}));
  if(reservation.status===429)return json({ok:false,error:'MISSION_RATE_LIMIT',message:'Director mission quota reached. Try again after the cooldown.'},429);
  if(!reservation.ok)return json({ok:false,error:'MISSION_RESERVATION_FAILED'},503);
 }catch{return json({ok:false,error:'MISSION_RESERVATION_FAILED'},503);}
 const id=crypto.randomUUID();
 try{
  const started=await instance.fetch(roomRequest('/tasks/start','POST',{id,question}));
  if(!started.ok)return json({ok:false,error:'TASK_START_FAILED'},503);
 }catch{return json({ok:false,error:'TASK_START_FAILED'},503);}
 const finishTask=async(status:'COMPLETED'|'FAILED',finding:string,reports:unknown[]=[],limitations:string[]=[])=>{
  const finished=await instance.fetch(roomRequest('/tasks/finish','POST',{id,status,finding,reports,limitations}));
  return finished.ok;
 };
 try{
  const response=await forward(request);
  if(!response.ok){
   await finishTask('FAILED','Research request did not complete.');
   return response;
  }
  const original=await response.json() as Record<string,unknown>;
  if(!original||original.ok!==true){
   await finishTask('FAILED','No valid director report was produced.');
   return json({ok:false,error:'INVALID_DIRECTOR_REPORT'},503);
  }
  if(original.question!==question)return json({ok:false,error:'INVALID_DIRECTOR_REPORT'},503);
  const entry:AtlasJournalItem={
   id,createdAt:new Date().toISOString(),request:question,response:{...original,missionId:id,durable:true}
  };
  const saved=await instance.fetch(roomRequest('/missions','POST',entry));
  if(!saved.ok){
   await finishTask('FAILED','Director report could not be persisted.');
   return json({ok:false,error:'MISSION_PERSISTENCE_FAILED',
    message:'ATLAS completed the research but could not preserve its report. The result was withheld for integrity.'
   },503);
  }
  const dispatches=Array.isArray(original.dispatches)?original.dispatches:[];
  const reports=dispatches.slice(0,10).map(value=>{
   const item=value&&typeof value==='object'?value as Record<string,unknown>:{};
   return {
    agent:typeof item.agentId==='string'?item.agentId:'atlas',
    stage:typeof item.stage==='string'?item.stage:'RESEARCH',
    status:item.status==='FAILED'?'FAILED':'COMPLETED',
    startedAt:typeof item.startedAt==='string'?item.startedAt:entry.createdAt,
    question:typeof item.instruction==='string'?item.instruction:'',
    finding:typeof item.finding==='string'?item.finding:'',
    evidence:Array.isArray(item.sources)?item.sources:[],
    limitations:Array.isArray(item.limitations)?item.limitations:[]
   };
  });
  if(!await finishTask('COMPLETED',typeof original.summary==='string'?original.summary:'Director research complete.',reports)){
   return json({ok:false,error:'DIRECTOR_TASK_FINALIZATION_FAILED',
    message:'Mission journal exists but the collaboration task could not be finalized.'
   },503);
  }
  return json({...original,missionId:id,durable:true,persisted:true});

 }catch{
  try{await finishTask('FAILED','ATLAS request failed or the mission could not be finalized.');}catch{/* preserve primary error */}
  return json({ok:false,error:'ATLAS_GATEWAY_FAILED',message:'Director gateway failed. No completed mission was claimed.'},503);
 }
}
