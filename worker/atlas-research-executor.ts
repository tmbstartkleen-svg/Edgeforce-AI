// Private bridge from durable scheduled research to a trusted ATLAS researcher.
// No Worker route, alarm, cron, or automatic authorization is provided.
import {runAtlasScheduledTask} from './atlas-execution-coordinator';
import type {SchedulerStore} from './atlas-task-transitions';
import type {AtlasScheduleRecord} from './atlas-task-scheduling';

export async function executeAtlasScheduledResearch(storage:SchedulerStore,input:{
 id:string;expectedState:AtlasScheduleRecord['state'];expectedAttempts:number;
 token:string;now:number;durationMs:number;enabled:boolean;
 ownerAuthorized:boolean;providerHealthy:boolean;clock:()=>number;
 research:(question:string)=>Promise<{ok:true}|{ok:false;reason:string}>;
}){
 if(!input.ownerAuthorized)return {ok:false as const,stage:'claim' as const,reason:'OWNER_APPROVAL_REQUIRED'};
 if(!input.enabled)return {ok:false as const,stage:'claim' as const,reason:'SCHEDULER_DISABLED'};
 if(!input.providerHealthy)return {ok:false as const,stage:'claim' as const,reason:'PROVIDER_UNHEALTHY'};
 if(typeof input.research!=='function')return {ok:false as const,stage:'claim' as const,reason:'INVALID_RESEARCH_EXECUTOR'};
 if(!/^[A-Za-z0-9-]{12,90}$/.test(input.id))return {ok:false as const,stage:'claim' as const,reason:'INVALID_TASK_ID'};
 const instruction=await storage.transaction(txn=>txn.get<{question:string}>('atlas-research:'+input.id));
 if(!instruction||typeof instruction.question!=='string'||instruction.question.trim().length<3||
    instruction.question.length>500)
  return {ok:false as const,stage:'claim' as const,reason:'RESEARCH_INSTRUCTION_MISSING'};
 const question=instruction.question;
 // The trusted provider adapter must return an explicit success result.
 // Never allow an unstructured or mismatched report to count as completed work.
 return runAtlasScheduledTask(storage,{...input,execute:async()=>{
  const result=await input.research(question);
  if(!result||result.ok!==true)return {ok:false,reason:result?.ok===false?result.reason:'INVALID_RESEARCH_RESULT'};
  return {ok:true};
 }});
}
