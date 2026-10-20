// Build 410: opt-in durable task creation. This module never dispatches jobs.
import type {AtlasScheduleRecord} from './atlas-task-scheduling';
import type {SchedulerStore} from './atlas-task-transitions';
import {ATLAS_MAX_AGE_MS} from './atlas-task-scheduling';

export async function enqueueAtlasSchedule(
 storage:SchedulerStore,
 input:{id:string;createdAt:string;nextRunAt:string;expiresAt:string},
 guards:{ownerAuthorized:boolean;enabled:boolean;now:number}
):Promise<{ok:boolean;reason:string}>{
 if(!guards.enabled)return {ok:false,reason:'SCHEDULER_DISABLED'};
 if(!guards.ownerAuthorized)return {ok:false,reason:'OWNER_APPROVAL_REQUIRED'};
 if(!/^[A-Za-z0-9-]{12,90}$/.test(input.id))return {ok:false,reason:'INVALID_TASK_ID'};
 const created=Date.parse(input.createdAt),due=Date.parse(input.nextRunAt),expires=Date.parse(input.expiresAt);
 if(!Number.isFinite(guards.now)||![created,due,expires].every(Number.isFinite)||
  created>guards.now||due<created||expires<=due||expires>created+ATLAS_MAX_AGE_MS)
  return {ok:false,reason:'INVALID_TASK_WINDOW'};
 return storage.transaction(async txn=>{
  const key='atlas-schedule:'+input.id;
  const existing=await txn.get<AtlasScheduleRecord>(key);
  if(existing)return {ok:false,reason:'DUPLICATE_TASK'};
  const record:AtlasScheduleRecord={...input,state:'QUEUED',attempts:0};
  await txn.put(key,record);
  return {ok:true,reason:'QUEUED'};
 });
}
