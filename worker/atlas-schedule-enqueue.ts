// Build 410: opt-in durable task creation. This module never dispatches jobs.
import type {AtlasScheduleRecord} from './atlas-task-scheduling';
import type {SchedulerStore} from './atlas-task-transitions';
import {ATLAS_MAX_AGE_MS} from './atlas-task-scheduling';

export async function enqueueAtlasSchedule(
 storage:SchedulerStore,
 input:{id:string;createdAt:string;nextRunAt:string;expiresAt:string;question?:string},
 guards:{ownerAuthorized:boolean;enabled:boolean;now:number}
):Promise<{ok:boolean;reason:string}>{
 if(!guards.enabled)return {ok:false,reason:'SCHEDULER_DISABLED'};
 if(!guards.ownerAuthorized)return {ok:false,reason:'OWNER_APPROVAL_REQUIRED'};
 if(!/^[A-Za-z0-9-]{12,90}$/.test(input.id))return {ok:false,reason:'INVALID_TASK_ID'};
 if(input.question!==undefined&&(typeof input.question!=='string'||input.question.trim().length<3||input.question.length>500))
  return {ok:false,reason:'INVALID_RESEARCH_QUESTION'};
 const created=Date.parse(input.createdAt),due=Date.parse(input.nextRunAt),expires=Date.parse(input.expiresAt);
 if(!Number.isFinite(guards.now)||![created,due,expires].every(Number.isFinite)||
  created>guards.now||due<created||expires<=due||expires>created+ATLAS_MAX_AGE_MS)
  return {ok:false,reason:'INVALID_TASK_WINDOW'};
 return storage.transaction(async txn=>{
  const key='atlas-schedule:'+input.id;
  const existing=await txn.get<AtlasScheduleRecord>(key);
  if(existing)return {ok:false,reason:'DUPLICATE_TASK'};
  const record:AtlasScheduleRecord={id:input.id,createdAt:input.createdAt,nextRunAt:input.nextRunAt,expiresAt:input.expiresAt,state:'QUEUED',attempts:0};
  await txn.put(key,record);
  if(input.question!==undefined)await txn.put('atlas-research:'+input.id,{question:input.question.trim()});
  return {ok:true,reason:'QUEUED'};
 });
}
