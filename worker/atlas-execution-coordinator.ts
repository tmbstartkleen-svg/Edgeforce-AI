// Build 410: private, explicitly invoked coordinator. No routes, timers or cron.
// Only trusted server code may supply authorization and a bounded task callback.
import {claimAtlasScheduledExecution,completeAtlasLeasedExecution} from './atlas-leased-execution';
import type {SchedulerStore} from './atlas-task-transitions';
import type {AtlasScheduleRecord} from './atlas-task-scheduling';

export async function runAtlasScheduledTask(storage:SchedulerStore,input:{
 id:string;expectedState:AtlasScheduleRecord['state'];expectedAttempts:number;
 token:string;now:number;durationMs:number;enabled:boolean;
 ownerAuthorized:boolean;providerHealthy:boolean;
 execute:()=>Promise<{ok:true}|{ok:false;reason:string}>;
 clock:()=>number;
}):Promise<{ok:true}|{ok:false;stage:'claim'|'execute'|'complete';reason:string}>{
 if(!input.ownerAuthorized)return {ok:false,stage:'claim',reason:'OWNER_APPROVAL_REQUIRED'};
 if(!input.enabled)return {ok:false,stage:'claim',reason:'SCHEDULER_DISABLED'};
 if(!input.providerHealthy)return {ok:false,stage:'claim',reason:'PROVIDER_UNHEALTHY'};
 const claim=await claimAtlasScheduledExecution(storage,input);
 if(!claim.ok)return {ok:false,stage:'claim',reason:claim.reason};
 // Recheck the clock after the durable claim, before starting any side effect.
 // An expired lease must never initiate a provider call.
 let startedAt:number;
 try{startedAt=input.clock();}catch{return {ok:false,stage:'execute',reason:'CLOCK_UNAVAILABLE'};}
 if(!Number.isFinite(startedAt)||startedAt<claim.lease.acquiredAt||startedAt>=claim.lease.expiresAt)
  return {ok:false,stage:'execute',reason:'LEASE_NOT_ACTIVE'};
 let executed:{ok:true}|{ok:false;reason:string};
 try{executed=await input.execute();}
 catch{return {ok:false,stage:'execute',reason:'EXECUTION_FAILED'};}
 if(!executed||executed.ok!==true)
  return {ok:false,stage:'execute',reason:executed?.ok===false?executed.reason:'INVALID_EXECUTION_RESULT'};
 let now:number;
 try{now=input.clock();}catch{return {ok:false,stage:'complete',reason:'CLOCK_UNAVAILABLE'};}
 if(!Number.isFinite(now))return {ok:false,stage:'complete',reason:'INVALID_TIME'};
 const completed=await completeAtlasLeasedExecution(storage,{
  id:input.id,token:input.token,epoch:claim.lease.epoch,now,
  enabled:input.enabled,ownerAuthorized:input.ownerAuthorized,providerHealthy:input.providerHealthy
 });
 return completed.ok?{ok:true}:{ok:false,stage:'complete',reason:completed.reason};
}
