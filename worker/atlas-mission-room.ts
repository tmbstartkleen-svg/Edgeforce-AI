import {enqueueAtlasSchedule} from './atlas-schedule-enqueue';
import {transitionAtlasSchedule} from './atlas-task-transitions';
import {claimAtlasScheduledExecution,completeAtlasLeasedExecution,cancelAtlasLeasedExecution} from './atlas-leased-execution';
// Build 408: private durable journal for the Founder-led ATLAS mission room.
// The native Cloudflare Durable Object maintains one serialized room state.
// It is intentionally NOT public-routed: only the authenticated Worker gateway
// forwards requests to this class.
export type AtlasJournalItem={
 id:string;createdAt:string;request:string;response:Record<string,unknown>;
};
type RoomStore={
 get<T>(key:string):Promise<T|undefined>;
 put<T>(key:string,value:T):Promise<void>;
 transaction<T>(operation:(txn:RoomStore)=>Promise<T>):Promise<T>;
};
type RoomState={storage:RoomStore};
export type DirectorTask={
 id:string;missionId:string;agent:string;question:string;stage:string;
 status:'RUNNING'|'COMPLETED'|'FAILED'|'INTERRUPTED';
 createdAt:string;finishedAt?:string;finding?:string;
 evidence:string[];limitations:string[];
};
const MAX_DIRECTOR_TASKS=120;
const VALID_DIRECTORS=new Set(['atlas','mercury','vector','pulse','flash','sentinel','forge']);

type Reservation={lastMinute:number[];lastHour:number[]};
const NO_STORE={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
const json=(payload:unknown,status=200)=>Response.json(payload,{status,headers:NO_STORE});
const MAX_MISSIONS=30;
const MAX_BODY=100_000;
const MAX_MINUTE=2;
const MAX_HOUR=12;

export class AtlasMissionRoom {
 constructor(private readonly state:RoomState){}
 async fetch(request:Request):Promise<Response>{
  const url=new URL(request.url);
  if(url.hostname!=='atlas.internal')return json({ok:false,error:'INTERNAL_ONLY'},403);
  // Internal-only integration. No public gateway route, cron, or executor exists.
  // Both mutations are deliberately disabled until a separately reviewed activation.
  // Read-only task inspection; never expose execution lease tokens.
  if(url.pathname==='/schedule/task'&&request.method==='GET'){
   const id=url.searchParams.get('id')||'';
   if(!/^[A-Za-z0-9-]{12,90}$/.test(id))return json({ok:false,error:'INVALID_TASK_ID'},400);
   const task=await this.state.storage.get<import('./atlas-task-scheduling').AtlasScheduleRecord>('atlas-schedule:'+id);
   if(!task)return json({ok:false,error:'TASK_NOT_FOUND'},404);
   return json({ok:true,task});
  }
  if(url.pathname==='/schedule/status'&&request.method==='GET'){
   return json({ok:true,enabled:false,ready:false,executionMode:'disabled',
    durableStorageAvailable:typeof this.state.storage.transaction==='function',
    enqueueImplemented:typeof enqueueAtlasSchedule==='function',
    transitionsImplemented:typeof transitionAtlasSchedule==='function',
    fencedClaimImplemented:typeof claimAtlasScheduledExecution==='function',
    fencedCompletionImplemented:typeof completeAtlasLeasedExecution==='function',
    executorConnected:false,cronConnected:false,liveDispatchVerified:false,
    blockers:['OWNER_ACTIVATION_REQUIRED','EXECUTOR_NOT_CONNECTED','NO_LIVE_DISPATCH_CERTIFICATION']});
  }
  // Explicitly disabled for every non-status scheduler route until the
  // authenticated gateway and runtime executor pass a separate review.
  // The lease functions remain available for isolated behavioral testing.
  // The Durable Object refuses lifecycle execution regardless of any
  // caller-provided authorization flags. The gateway must authorize a future
  // activation independently; request JSON can never activate scheduling.
  // Owner-authenticated gateway may cancel already-stored work even when
  // execution is disabled. The ownerAuthorized value is assigned server-side.
  if(url.pathname==='/schedule/cancel'&&request.method==='POST'){
   let payload:unknown;
   try{payload=await request.json();}catch{return json({ok:false,error:'INVALID_JSON'},400);}
   if(!payload||typeof payload!=='object'||Array.isArray(payload))return json({ok:false,error:'INVALID_CANCEL'},400);
   const data=payload as Record<string,unknown>;
   if(typeof data.id!=='string'||typeof data.expectedState!=='string'||
      typeof data.expectedAttempts!=='number')return json({ok:false,error:'INVALID_CANCEL'},400);
   const result=await cancelAtlasLeasedExecution(this.state.storage,{
    id:data.id,expectedState:data.expectedState as 'QUEUED'|'RUNNING'|'RETRY_WAIT'|'COMPLETED'|'FAILED'|'CANCELLED',
    expectedAttempts:data.expectedAttempts,ownerAuthorized:true
   });
   return json(result,result.ok?200:409);
  }
  if(url.pathname==='/schedule/lifecycle'&&request.method==='POST'){
   return json({ok:false,error:'SCHEDULER_DISABLED',activationRequired:true},403);
  }
  if(url.pathname.startsWith('/schedule/')&&request.method!=='GET'){
   return json({ok:false,error:'SCHEDULER_DISABLED'},403);
  }
  if(request.method==='GET'&&url.pathname==='/history'){
   const missions=await this.state.storage.get<AtlasJournalItem[]>('missions')||[];
   const max=Math.min(30,Math.max(1,Number(url.searchParams.get('limit')||15)||15));
   return json({ok:true,durable:true,owner:'Founder',director:'ATLAS',missions:missions.slice(-max)});
  }
  if(request.method==='POST'&&url.pathname==='/reserve'){
   const now=Date.now();
   const result=await this.state.storage.transaction(async txn=>{
    const prior=await txn.get<Reservation>('reservations')||{lastMinute:[],lastHour:[]};
    const lastMinute=prior.lastMinute.filter(t=>t>now-60_000);
    const lastHour=prior.lastHour.filter(t=>t>now-3_600_000);
    if(lastMinute.length>=MAX_MINUTE||lastHour.length>=MAX_HOUR){
     return {allowed:false,retryAfterSec:lastMinute.length>=MAX_MINUTE?60:3600};
    }
    lastMinute.push(now);lastHour.push(now);
    await txn.put('reservations',{lastMinute,lastHour});
    return {allowed:true,retryAfterSec:0};
   });
   return json({ok:result.allowed,...result},result.allowed?200:429);
  }
  if(request.method==='POST'&&url.pathname==='/missions'){
   const size=Number(request.headers.get('content-length')||0);
   if(size>MAX_BODY)return json({ok:false,error:'MISSION_TOO_LARGE'},413);
   let entry:AtlasJournalItem;
   try{
    const raw=await request.text();
    if(new TextEncoder().encode(raw).length>MAX_BODY)return json({ok:false,error:'MISSION_TOO_LARGE'},413);
    const value=JSON.parse(raw) as Partial<AtlasJournalItem>;
    if(!value||typeof value!=='object'||!value.id||typeof value.id!=='string'
      ||value.id.length>90||typeof value.request!=='string'||value.request.length>500
      ||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt))
      ||!value.response||typeof value.response!=='object'||Array.isArray(value.response)
      ||value.response.ok!==true)return json({ok:false,error:'INVALID_MISSION'},400);
    entry={id:value.id,request:value.request,createdAt:value.createdAt,response:value.response};
   }catch{return json({ok:false,error:'INVALID_JSON'},400);}
   const total=await this.state.storage.transaction(async txn=>{
    const previous=await txn.get<AtlasJournalItem[]>('missions')||[];
    if(previous.some(x=>x.id===entry.id))return previous.length;
    const next=[...previous,entry].slice(-MAX_MISSIONS);
    await txn.put('missions',next);
    return next.length;
   });
   return json({ok:true,persisted:true,id:entry.id,recordCount:total});
  }
  if(request.method==='GET'&&url.pathname==='/tasks'){
   const all=await this.state.storage.get<DirectorTask[]>('directorTasks')||[];
   const agent=url.searchParams.get('agent')||'';
   if(agent&&!VALID_DIRECTORS.has(agent))return json({ok:false,error:'UNKNOWN_DIRECTOR'},400);
   const limit=Math.min(120,Math.max(1,Number(url.searchParams.get('limit')||40)||40));
   const now=Date.now();
   const tasks=all.map(task=>task.status==='RUNNING'&&now-Date.parse(task.createdAt)>300000
    ?{...task,status:'INTERRUPTED' as const,limitations:[...task.limitations,'Execution was interrupted before durable completion.']}
    :task).filter(task=>!agent||task.agent===agent).slice(-limit);
   return json({ok:true,durable:true,owner:'Founder',director:'ATLAS',executionMode:'request-scoped',tasks});
  }
  if(request.method==='POST'&&url.pathname==='/tasks/start'){
   const raw=await request.text();
   if(raw.length>1200)return json({ok:false,error:'INVALID_TASK'},413);
   let value:Record<string,unknown>;
   try{
    const parsed=JSON.parse(raw) as unknown;
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return json({ok:false,error:'INVALID_TASK'},400);
    value=parsed as Record<string,unknown>;
   }catch{return json({ok:false,error:'INVALID_JSON'},400);}
   const id=typeof value.id==='string'?value.id:'';
   const question=typeof value.question==='string'?value.question.trim():'';
   if(!/^[a-z0-9-]{20,90}$/i.test(id)||question.length<3||question.length>500)
    return json({ok:false,error:'INVALID_TASK'},400);
   const task:DirectorTask={
    id,missionId:id,agent:'atlas',question,stage:'PLAN',status:'RUNNING',
    createdAt:new Date().toISOString(),evidence:[],limitations:[]
   };
   const saved=await this.state.storage.transaction(async txn=>{
    const old=await txn.get<DirectorTask[]>('directorTasks')||[];
    if(old.some(item=>item.id===id))return false;
    await txn.put('directorTasks',[...old,task].slice(-MAX_DIRECTOR_TASKS));
    return true;
   });
   return json({ok:saved,id,status:saved?'RUNNING':'DUPLICATE'},saved?201:409);
  }
  if(request.method==='POST'&&url.pathname==='/tasks/finish'){
   let value:Record<string,unknown>;
   try{
    const raw=await request.text();
    if(raw.length>24000)return json({ok:false,error:'TASK_TOO_LARGE'},413);
    const parsed=JSON.parse(raw) as unknown;
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return json({ok:false,error:'INVALID_TASK'},400);
    value=parsed as Record<string,unknown>;
   }catch{return json({ok:false,error:'INVALID_JSON'},400);}
   const id=typeof value.id==='string'?value.id:'';
   const status=value.status;
   if(!/^[a-z0-9-]{20,90}$/i.test(id)||(status!=='COMPLETED'&&status!=='FAILED'))
    return json({ok:false,error:'INVALID_TASK'},400);
   const items=Array.isArray(value.reports)?value.reports.slice(0,10):[];
   const reports:DirectorTask[]=items.flatMap((item,index)=>{
    if(!item||typeof item!=='object'||Array.isArray(item))return [];
    const x=item as Record<string,unknown>;
    const agent=typeof x.agent==='string'?x.agent:'';
    if(!VALID_DIRECTORS.has(agent))return [];
    return [{
     id:id+'-'+index,missionId:id,agent,
     question:typeof x.question==='string'?x.question.slice(0,500):'Director research assignment',
     stage:typeof x.stage==='string'?x.stage.slice(0,30):'RESEARCH',
     status:x.status==='FAILED'?'FAILED' as const:'COMPLETED' as const,
     createdAt:typeof x.startedAt==='string'&&Number.isFinite(Date.parse(x.startedAt))?x.startedAt:new Date().toISOString(),
     finishedAt:new Date().toISOString(),
     finding:typeof x.finding==='string'?x.finding.slice(0,3500):'No report produced',
     evidence:Array.isArray(x.evidence)?x.evidence.filter(y=>typeof y==='string').slice(0,8).map(y=>(y as string).slice(0,180)):[],
     limitations:Array.isArray(x.limitations)?x.limitations.filter(y=>typeof y==='string').slice(0,8).map(y=>(y as string).slice(0,180)):[]
    }];
   });
   const changed=await this.state.storage.transaction(async txn=>{
    const old=await txn.get<DirectorTask[]>('directorTasks')||[];
    const idx=old.findIndex(item=>item.id===id);
    if(idx<0||old[idx].status!=='RUNNING')return false;
    const next=[...old];
    next[idx]={
     ...next[idx],status,
     finishedAt:new Date().toISOString(),
     finding:typeof value.finding==='string'?value.finding.slice(0,3500):'No executive report recorded',
     limitations:Array.isArray(value.limitations)?value.limitations.filter(y=>typeof y==='string').slice(0,8).map(y=>(y as string).slice(0,180)):[]
    };
    await txn.put('directorTasks',[...next,...reports].slice(-MAX_DIRECTOR_TASKS));
    return true;
   });
   return json({ok:changed,id,reportCount:reports.length},changed?200:409);
  }
  return json({ok:false,error:'NOT_FOUND'},404);
 }
}
