// Build 410 foundation: bounded, opt-in scheduling decisions for ATLAS research.
// Pure policy only. No cron, external fetch, wagering, or automatic retries are enabled.
export type AtlasScheduleState = 'QUEUED'|'RUNNING'|'RETRY_WAIT'|'COMPLETED'|'FAILED'|'CANCELLED';
export type AtlasScheduleRecord = {
 id:string; state:AtlasScheduleState; attempts:number; createdAt:string;
 nextRunAt:string; expiresAt:string; lastError?:string;
};
export type AtlasScheduleDecision = {ready:boolean;reason:string;nextRunAt?:string};
export const ATLAS_MAX_ATTEMPTS=3;
export const ATLAS_MAX_AGE_MS=60*60*1000;
export const ATLAS_RETRY_DELAYS_MS=[60_000,5*60_000] as const;
const validTime=(value:string)=>{const n=Date.parse(value);return Number.isFinite(n)?n:null;};

// Scheduler must be explicitly activated and have both owner authorization
// and a healthy provider quota. Defaults are always fail-closed.
export function canDispatchAtlasTask(
 task:AtlasScheduleRecord,
 opts:{enabled:boolean;ownerAuthorized:boolean;providerHealthy:boolean;now:number}
):AtlasScheduleDecision{
 if(!opts.enabled)return {ready:false,reason:'SCHEDULER_DISABLED'};
 if(!opts.ownerAuthorized)return {ready:false,reason:'OWNER_APPROVAL_REQUIRED'};
 if(!opts.providerHealthy)return {ready:false,reason:'PROVIDER_UNHEALTHY'};
 if(!Number.isFinite(opts.now))return {ready:false,reason:'INVALID_TIME'};
 const created=validTime(task.createdAt),due=validTime(task.nextRunAt),expires=validTime(task.expiresAt);
 if(created===null||due===null||expires===null||created>opts.now||expires<=created||
   expires>created+ATLAS_MAX_AGE_MS)return {ready:false,reason:'INVALID_TASK_WINDOW'};
 if(opts.now>=expires)return {ready:false,reason:'TASK_EXPIRED'};
 if(task.attempts<0||!Number.isInteger(task.attempts)||task.attempts>=ATLAS_MAX_ATTEMPTS)
  return {ready:false,reason:'ATTEMPT_LIMIT'};
 if(task.state!=='QUEUED'&&task.state!=='RETRY_WAIT')
  return {ready:false,reason:'NOT_DISPATCHABLE'};
 if(due>opts.now)return {ready:false,reason:'NOT_DUE',nextRunAt:new Date(due).toISOString()};
 return {ready:true,reason:'READY'};
}

// Use fixed delays to cap subrequest and CPU exposure; caller must persist
// the transition atomically in the Durable Object before dispatch.
export function nextAtlasRetry(
 task:AtlasScheduleRecord, now:number, error:string
):AtlasScheduleRecord{
 if(task.state!=='RUNNING')throw new Error('RETRY_REQUIRES_RUNNING');
 if(!Number.isFinite(now))throw new Error('INVALID_TIME');
 const attempts=task.attempts+1,expires=validTime(task.expiresAt);
 if(expires===null)throw new Error('INVALID_EXPIRY');
 const retryDelay=ATLAS_RETRY_DELAYS_MS[attempts-1];
 const allowed=attempts<ATLAS_MAX_ATTEMPTS&&retryDelay!==undefined&&now+retryDelay<expires;
 return {...task,attempts,
  state:allowed?'RETRY_WAIT':'FAILED',
  nextRunAt:allowed?new Date(now+retryDelay).toISOString():task.nextRunAt,
  lastError:error.slice(0,200)
 };
}

// Pure state transitions. Storage must use a compare-and-swap/transaction guard
// to prevent two workers from claiming the same queued mission.
export function claimAtlasTask(
 task:AtlasScheduleRecord,
 opts:{enabled:boolean;ownerAuthorized:boolean;providerHealthy:boolean;now:number}
):AtlasScheduleRecord{
 const gate=canDispatchAtlasTask(task,opts);
 if(!gate.ready)throw new Error(gate.reason);
 return {...task,state:'RUNNING'};
}

export function cancelAtlasTask(task:AtlasScheduleRecord):AtlasScheduleRecord{
 if(task.state==='COMPLETED'||task.state==='FAILED'||task.state==='CANCELLED')
  throw new Error('TASK_ALREADY_TERMINAL');
 return {...task,state:'CANCELLED'};
}

export function completeAtlasTask(task:AtlasScheduleRecord):AtlasScheduleRecord{
 if(task.state!=='RUNNING')throw new Error('COMPLETE_REQUIRES_RUNNING');
 return {...task,state:'COMPLETED'};
}

export function atlasScheduleHealth(tasks:readonly AtlasScheduleRecord[],now:number){
 if(!Number.isFinite(now))throw new Error('INVALID_TIME');
 const counts={queued:0,running:0,retryWait:0,completed:0,failed:0,cancelled:0,expired:0};
 for(const task of tasks){
  const expires=validTime(task.expiresAt);
  if(expires===null||now>=expires){counts.expired++;continue;}
  switch(task.state){
   case 'QUEUED':counts.queued++;break;
   case 'RUNNING':counts.running++;break;
   case 'RETRY_WAIT':counts.retryWait++;break;
   case 'COMPLETED':counts.completed++;break;
   case 'FAILED':counts.failed++;break;
   case 'CANCELLED':counts.cancelled++;break;
  }
 }
 return counts;
}

 // Recovery policy for a task whose owner invocation disappeared.
 // Without a persisted lease timestamp, a RUNNING task must never be
 // automatically reclaimed. This prevents duplicate LLM calls and costs.
export function inspectAtlasInterruptedTask(
 task:AtlasScheduleRecord,now:number
):{recoverable:false;reason:string}{
 if(!Number.isFinite(now))return {recoverable:false,reason:'INVALID_TIME'};
 if(task.state!=='RUNNING')return {recoverable:false,reason:'NOT_RUNNING'};
 const expires=validTime(task.expiresAt);
 if(expires===null||now>=expires)return {recoverable:false,reason:'TASK_EXPIRED'};
 return {recoverable:false,reason:'MISSING_EXECUTION_LEASE'};
}
