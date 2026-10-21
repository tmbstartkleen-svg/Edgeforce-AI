// Explicit private composition of durable queued research and the Director adapter.
// No HTTP endpoint, cron, alarm or autonomous activation is defined here.
import {executeAtlasScheduledResearch} from './atlas-research-executor';
import {createAtlasResearchProviderAdapter} from './atlas-research-provider-adapter';
import type {SchedulerStore} from './atlas-task-transitions';
import type {AtlasScheduleRecord} from './atlas-task-scheduling';

export function runAtlasScheduledDirector(storage:SchedulerStore,input:{
 id:string;expectedState:AtlasScheduleRecord['state'];expectedAttempts:number;
 token:string;now:number;durationMs:number;enabled:boolean;
 ownerAuthorized:boolean;providerHealthy:boolean;clock:()=>number;
 // Must be the existing authenticated, quota-limited Director forwarder.
 forward:(request:Request)=>Promise<Response>;origin:string;
}){
 if(!input.ownerAuthorized)return Promise.resolve({ok:false as const,stage:'claim' as const,reason:'OWNER_APPROVAL_REQUIRED'});
 if(!input.enabled)return Promise.resolve({ok:false as const,stage:'claim' as const,reason:'SCHEDULER_DISABLED'});
 if(typeof input.forward!=='function')return Promise.resolve({ok:false as const,stage:'claim' as const,reason:'INVALID_DIRECTOR_FORWARDER'});
 // The forwarder must be a trusted runtime callback, not an arbitrary URL.
 // A valid HTTPS origin is required before the task can be claimed.
 let origin:URL;
 try{origin=new URL(input.origin);}catch{return Promise.resolve({ok:false as const,stage:'claim' as const,reason:'INVALID_DIRECTOR_ORIGIN'});}
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)
  return Promise.resolve({ok:false as const,stage:'claim' as const,reason:'INVALID_DIRECTOR_ORIGIN'});
 return executeAtlasScheduledResearch(storage,{
  ...input,research:createAtlasResearchProviderAdapter(input.forward,input.origin)
 });
}
