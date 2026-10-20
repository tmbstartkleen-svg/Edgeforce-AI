// Build 410: durable, fenced claim. Remains private and disabled unless
// a separately authenticated caller explicitly enables the operation.
import {claimAtlasTask,type AtlasScheduleRecord} from './atlas-task-scheduling';
import {createAtlasExecutionLease,verifyAtlasExecutionLease,type AtlasExecutionLease} from './atlas-execution-lease';
import type {SchedulerStore} from './atlas-task-transitions';
export type LeasedClaim={ok:true;task:AtlasScheduleRecord;lease:AtlasExecutionLease}|{ok:false;reason:string};
const TASK='atlas-schedule:',LEASE='atlas-lease:',EPOCH='atlas-lease-epoch:';
const ID=/^[A-Za-z0-9-]{12,90}$/;
export async function claimAtlasScheduledExecution(storage:SchedulerStore,input:{
 id:string;expectedState:AtlasScheduleRecord['state'];expectedAttempts:number;
 token:string;now:number;durationMs:number;enabled:boolean;
 ownerAuthorized:boolean;providerHealthy:boolean;
}):Promise<LeasedClaim>{
 if(!ID.test(input.id))return {ok:false,reason:'INVALID_TASK_ID'};
 if(!input.ownerAuthorized)return {ok:false,reason:'OWNER_APPROVAL_REQUIRED'};
 if(!input.enabled)return {ok:false,reason:'SCHEDULER_DISABLED'};
 if(!input.providerHealthy)return {ok:false,reason:'PROVIDER_UNHEALTHY'};
 return storage.transaction(async txn=>{
  const task=await txn.get<AtlasScheduleRecord>(TASK+input.id);
  if(!task||task.id!==input.id)return {ok:false,reason:'TASK_NOT_FOUND'};
  if(task.state!==input.expectedState||task.attempts!==input.expectedAttempts)
   return {ok:false,reason:'STALE_TRANSITION'};
  const existing=await txn.get<AtlasExecutionLease>(LEASE+input.id);
  // Fail closed: no automated lease takeover, even after expiry.
  if(existing)return {ok:false,reason:'LEASE_ALREADY_EXISTS'};
  const epoch=await txn.get<number>(EPOCH+input.id)??0;
  try{
   const lease=createAtlasExecutionLease(input.id,input.token,input.now,input.durationMs,epoch);
   const next=claimAtlasTask(task,input);
   if(lease.expiresAt>=Date.parse(task.expiresAt))return {ok:false,reason:'LEASE_OUTLIVES_TASK'};
   await txn.put(TASK+input.id,next);
   await txn.put(LEASE+input.id,lease);
   await txn.put(EPOCH+input.id,lease.epoch);
   return {ok:true,task:next,lease};
  }catch(e){return {ok:false,reason:e instanceof Error?e.message:'INVALID_CLAIM'};}
 });
}
export async function completeAtlasLeasedExecution(storage:SchedulerStore,input:{
 id:string;token:string;epoch:number;now:number;enabled:boolean;
 ownerAuthorized:boolean;providerHealthy:boolean;
}):Promise<{ok:true}|{ok:false;reason:string}>{
 if(!ID.test(input.id))return {ok:false,reason:'INVALID_TASK_ID'};
 if(!input.ownerAuthorized)return {ok:false,reason:'OWNER_APPROVAL_REQUIRED'};
 if(!input.enabled)return {ok:false,reason:'SCHEDULER_DISABLED'};
 if(!input.providerHealthy)return {ok:false,reason:'PROVIDER_UNHEALTHY'};
 return storage.transaction(async txn=>{
  const task=await txn.get<AtlasScheduleRecord>(TASK+input.id);
  if(!task||task.state!=='RUNNING')return {ok:false,reason:'TASK_NOT_RUNNING'};
  const lease=await txn.get<AtlasExecutionLease>(LEASE+input.id);
  const valid=verifyAtlasExecutionLease(lease,input.id,input.token,input.epoch,input.now);
  if(!valid.ok)return {ok:false,reason:valid.reason};
  if(input.now>=Date.parse(task.expiresAt))return {ok:false,reason:'TASK_EXPIRED'};
  await txn.put(TASK+input.id,{...task,state:'COMPLETED'});
  return {ok:true};
 });
}
