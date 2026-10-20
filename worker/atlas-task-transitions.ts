// Build 410: durable, atomic state transitions for a single ATLAS schedule record.
// Not wired to a cron, an external executor, or production routes.
import {
 claimAtlasTask, cancelAtlasTask, completeAtlasTask, nextAtlasRetry,
 type AtlasScheduleRecord
} from './atlas-task-scheduling';

export type SchedulerTxn={
 get<T>(key:string):Promise<T|undefined>;
 put<T>(key:string,value:T):Promise<void>;
};
export type SchedulerStore={
 transaction<T>(fn:(txn:SchedulerTxn)=>Promise<T>):Promise<T>;
};
export type SchedulerAction='CLAIM'|'CANCEL'|'COMPLETE'|'RETRY';
export type TransitionResult={ok:true;task:AtlasScheduleRecord}|{ok:false;reason:string};
const PREFIX='atlas-schedule:';
const VALID_ID=/^[A-Za-z0-9-]{12,90}$/;

// The expected state and attempts defend against stale or duplicate workers.
// All validation and mutation occurs inside one DO storage transaction.
// Durable scheduler activation and dispatch remain separately gated.
export async function transitionAtlasSchedule(
 storage:SchedulerStore,
 params:{
  id:string;expectedState:AtlasScheduleRecord['state'];expectedAttempts:number;
  action:SchedulerAction;now:number;
  enabled:boolean;ownerAuthorized:boolean;providerHealthy:boolean;
  error?:string;
 }
):Promise<TransitionResult>{
 if(!VALID_ID.test(params.id))return {ok:false,reason:'INVALID_TASK_ID'};
 if(!Number.isFinite(params.now)||!Number.isInteger(params.expectedAttempts)||params.expectedAttempts<0)
  return {ok:false,reason:'INVALID_EXPECTATION'};
 // Every mutating action requires Founder authorization, not only CLAIM/CANCEL.
 if(!params.ownerAuthorized)return {ok:false,reason:'OWNER_APPROVAL_REQUIRED'};
 return storage.transaction(async txn=>{
  const key=PREFIX+params.id;
  const current=await txn.get<AtlasScheduleRecord>(key);
  if(!current||current.id!==params.id)return {ok:false,reason:'TASK_NOT_FOUND'};
  if(current.state!==params.expectedState||current.attempts!==params.expectedAttempts)
   return {ok:false,reason:'STALE_TRANSITION'};
  // Never mark expired work successful or schedule retries after its deadline.
  if((params.action==='COMPLETE'||params.action==='RETRY')&&
    (!Number.isFinite(Date.parse(current.expiresAt))||params.now>=Date.parse(current.expiresAt)))
   return {ok:false,reason:'TASK_EXPIRED'};
  let next:AtlasScheduleRecord;
  try{
   switch(params.action){
    case 'CLAIM':
     next=claimAtlasTask(current,{
      enabled:params.enabled,ownerAuthorized:params.ownerAuthorized,
      providerHealthy:params.providerHealthy,now:params.now
     });break;
    case 'CANCEL':
     if(!params.ownerAuthorized)throw new Error('OWNER_APPROVAL_REQUIRED');
     next=cancelAtlasTask(current);break;
    case 'COMPLETE':
     next=completeAtlasTask(current);break;
    case 'RETRY':
     next=nextAtlasRetry(current,params.now,params.error||'Unspecified failure');break;
    default:return {ok:false,reason:'INVALID_ACTION'};
   }
  }catch(error){
   return {ok:false,reason:error instanceof Error?error.message:'INVALID_TRANSITION'};
  }
  await txn.put(key,next);
  return {ok:true,task:next};
 });
}
