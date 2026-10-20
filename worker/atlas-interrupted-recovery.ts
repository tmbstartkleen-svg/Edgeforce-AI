// Founder-only terminal recovery; never retries an interrupted side effect.
// A timed-out lease may have executed upstream, so automatic replay is unsafe.
import type {SchedulerStore} from './atlas-task-transitions';
import type {AtlasScheduleRecord} from './atlas-task-scheduling';
import type {AtlasExecutionLease} from './atlas-execution-lease';
const ID=/^[A-Za-z0-9-]{12,90}$/;
export async function failInterruptedAtlasTask(storage:SchedulerStore,input:{
 id:string;expectedAttempts:number;now:number;ownerAuthorized:boolean;
}):Promise<{ok:true}|{ok:false;reason:string}>{
 if(!input.ownerAuthorized)return {ok:false,reason:'OWNER_APPROVAL_REQUIRED'};
 if(!ID.test(input.id)||!Number.isSafeInteger(input.expectedAttempts)||input.expectedAttempts<0)
  return {ok:false,reason:'INVALID_EXPECTATION'};
 if(!Number.isFinite(input.now))return {ok:false,reason:'INVALID_TIME'};
 return storage.transaction(async txn=>{
  const task=await txn.get<AtlasScheduleRecord>('atlas-schedule:'+input.id);
  if(!task)return {ok:false,reason:'TASK_NOT_FOUND'};
  if(task.state!=='RUNNING'||task.attempts!==input.expectedAttempts)
   return {ok:false,reason:'STALE_TRANSITION'};
  const lease=await txn.get<AtlasExecutionLease>('atlas-lease:'+input.id);
  const epoch=await txn.get<number>('atlas-lease-epoch:'+input.id);
  if(!lease||!Number.isSafeInteger(epoch)||epoch!==lease.epoch||
     lease.taskId!==input.id||!Number.isFinite(lease.expiresAt))
   return {ok:false,reason:'LEASE_INTEGRITY_FAILURE'};
  if(input.now<lease.expiresAt)return {ok:false,reason:'LEASE_STILL_ACTIVE'};
  await txn.put('atlas-schedule:'+input.id,{
   ...task,state:'FAILED',lastError:'INTERRUPTED_EXECUTION_REQUIRES_MANUAL_REVIEW'
  });
  // Preserve the existing lease and epoch as permanent replay fences.
  return {ok:true};
 });
}
