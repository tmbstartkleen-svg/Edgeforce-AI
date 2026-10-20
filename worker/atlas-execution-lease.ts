// Build 410: fenced execution leases. Pure decisions only; no task execution.
// A random execution token must be minted by the authenticated caller and
// persisted transactionally with the task before any external side effect.
export type AtlasExecutionLease={
 taskId:string; token:string; acquiredAt:number; expiresAt:number; epoch:number;
};
const TOKEN=/^[A-Za-z0-9_-]{32,128}$/;
const MAX_LEASE_MS=60_000;
export function createAtlasExecutionLease(
 taskId:string,token:string,now:number,durationMs:number,previousEpoch:number
):AtlasExecutionLease{
 if(!/^[A-Za-z0-9-]{12,90}$/.test(taskId))throw Error('INVALID_TASK_ID');
 if(!TOKEN.test(token))throw Error('INVALID_LEASE_TOKEN');
 if(!Number.isFinite(now)||!Number.isInteger(durationMs)||durationMs<1000||durationMs>MAX_LEASE_MS)
  throw Error('INVALID_LEASE_WINDOW');
 if(!Number.isSafeInteger(previousEpoch)||previousEpoch<0||previousEpoch>=Number.MAX_SAFE_INTEGER)
  throw Error('INVALID_LEASE_EPOCH');
 return {taskId,token,acquiredAt:now,expiresAt:now+durationMs,epoch:previousEpoch+1};
}
export function verifyAtlasExecutionLease(
 lease:AtlasExecutionLease|undefined,taskId:string,token:string,epoch:number,now:number
):{ok:boolean;reason:string}{
 if(!lease)return {ok:false,reason:'LEASE_REQUIRED'};
 if(lease.taskId!==taskId||lease.token!==token||lease.epoch!==epoch)
  return {ok:false,reason:'STALE_EXECUTOR'};
 if(!Number.isFinite(now)||now<lease.acquiredAt||now>=lease.expiresAt)
  return {ok:false,reason:'LEASE_EXPIRED'};
 return {ok:true,reason:'VALID_LEASE'};
}
