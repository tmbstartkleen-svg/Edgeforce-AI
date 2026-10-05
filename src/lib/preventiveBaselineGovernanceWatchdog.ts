import {db} from './db';
import {RELEASE} from './releaseManifest';
import {runBaselineConsistencyGovernor} from './preventiveBaselineConsistency';

export function evaluateGovernanceWatchdog(input:{
 staleCycles:number;
 expiredLock:boolean;
 leaseLossCount:number;
}){
 const rationale:string[]=[];
 if(input.staleCycles>0)rationale.push(String(input.staleCycles)+' stale STARTED governance cycle(s) require recovery.');
 if(input.expiredLock)rationale.push('Expired governance lease should be cleared.');
 if(input.leaseLossCount>0)rationale.push(String(input.leaseLossCount)+' prior lease-loss event(s) are recorded.');
 return {
  status:input.staleCycles>0||input.expiredLock?'RECOVERY_REQUIRED' as const:input.leaseLossCount>0?'WATCH' as const:'HEALTHY' as const,
  rationale
 };
}

export async function noteGovernanceLeaseLoss(reason:string){
 const sql=db();if(!sql)return {recorded:false};
 await sql\`
  update preventive_baseline_governance_watchdog_state
  set lease_loss_count=lease_loss_count+1,last_reason=\${reason},updated_at=now()
  where singleton_key=1
 \`;
 return {recorded:true};
}

export async function runBaselineGovernanceWatchdog(){
 const sql=db();
 if(!sql)return {configured:false,status:'UNCONFIGURED',staleCyclesFound:0,staleCyclesRecovered:0,expiredLocksCleared:0,rationale:['Database is not configured.']};

 const stale=await sql\`
  select id,cycle_key as "cycleKey"
  from preventive_baseline_governance_cycles
  where status='STARTED'
   and coalesce(heartbeat_at,started_at)<now()-interval '3 minutes'
  order by started_at asc
  limit 50
 \`;
 const [lock]=await sql\`
  select lock_token as "lockToken",locked_until as "lockedUntil"
  from preventive_baseline_governance_lock where singleton_key=1
 \`;
 const expiredLock=Boolean(lock?.lockToken&&lock?.lockedUntil&&new Date(lock.lockedUntil).getTime()<Date.now());
 const [state]=await sql\`
  select lease_loss_count as "leaseLossCount"
  from preventive_baseline_governance_watchdog_state where singleton_key=1
 \`;
 const evaluation=evaluateGovernanceWatchdog({
  staleCycles:(stale as any[]).length,
  expiredLock,
  leaseLossCount:Number(state?.leaseLossCount||0)
 });

 let expiredLocksCleared=0;
 if(expiredLock){
  await sql\`
   update preventive_baseline_governance_lock
   set lock_token=null,locked_until=null,holder_model_version=null,cycle_key=null,updated_at=now()
   where singleton_key=1 and locked_until<now()
  \`;
  expiredLocksCleared=1;
 }

 let staleCyclesRecovered=0;
 for(const row of stale as any[]){
  await sql\`
   update preventive_baseline_governance_cycles
   set status='FAILED',completed_at=now(),
    error_text='V95 watchdog recovered stale STARTED cycle after heartbeat timeout.'
   where id=\${Number(row.id)} and status='STARTED'
  \`;
  staleCyclesRecovered++;
 }

 if(staleCyclesRecovered>0){
  await runBaselineConsistencyGovernor().catch(()=>({configured:false}));
 }

 const finalStatus=staleCyclesRecovered||expiredLocksCleared?'RECOVERED':evaluation.status;
 const rationale=[
  ...evaluation.rationale,
  ...(staleCyclesRecovered?['Recovered '+String(staleCyclesRecovered)+' stale governance cycle(s).']:[]),
  ...(expiredLocksCleared?['Cleared one expired governance lease.']:[])
 ];

 await sql\`
  insert into preventive_baseline_governance_watchdog_state(
   singleton_key,status,stale_cycles_found,stale_cycles_recovered,expired_locks_cleared,last_reason,updated_at
  ) values(
   1,\${finalStatus},\${(stale as any[]).length},\${staleCyclesRecovered},\${expiredLocksCleared},
   \${rationale.join(' ')},now()
  )
  on conflict(singleton_key) do update set
   status=excluded.status,stale_cycles_found=excluded.stale_cycles_found,
   stale_cycles_recovered=preventive_baseline_governance_watchdog_state.stale_cycles_recovered+excluded.stale_cycles_recovered,
   expired_locks_cleared=preventive_baseline_governance_watchdog_state.expired_locks_cleared+excluded.expired_locks_cleared,
   last_reason=excluded.last_reason,updated_at=now()
 \`;

 const [after]=await sql\`
  select lease_loss_count as "leaseLossCount",stale_cycles_recovered as "totalRecovered",
   expired_locks_cleared as "totalExpiredLocksCleared"
  from preventive_baseline_governance_watchdog_state where singleton_key=1
 \`;

 await sql\`
  insert into preventive_baseline_governance_watchdog_snapshots(
   model_version,status,stale_cycles_found,stale_cycles_recovered,expired_locks_cleared,lease_loss_count,rationale
  ) values(
   \${RELEASE.modelVersion},\${finalStatus},\${(stale as any[]).length},\${staleCyclesRecovered},\${expiredLocksCleared},
   \${Number(after?.leaseLossCount||0)},\${sql.json(rationale)}
  )
 \`;

 return {
  configured:true,status:finalStatus,staleCyclesFound:(stale as any[]).length,
  staleCyclesRecovered,expiredLocksCleared,leaseLossCount:Number(after?.leaseLossCount||0),rationale
 };
}

export async function loadBaselineGovernanceWatchdogSummary(){
 const sql=db();if(!sql)return {status:'UNCONFIGURED',staleCyclesFound:0,staleCyclesRecovered:0,expiredLocksCleared:0,leaseLossCount:0,rationale:[],recent:[]};
 try{
  const [state]=await sql\`
   select status,stale_cycles_found as "staleCyclesFound",stale_cycles_recovered as "staleCyclesRecovered",
    expired_locks_cleared as "expiredLocksCleared",lease_loss_count as "leaseLossCount",
    last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_baseline_governance_watchdog_state where singleton_key=1
  \`;
  const recent=await sql\`
   select id,status,stale_cycles_found as "staleCyclesFound",stale_cycles_recovered as "staleCyclesRecovered",
    expired_locks_cleared as "expiredLocksCleared",lease_loss_count as "leaseLossCount",generated_at as "generatedAt"
   from preventive_baseline_governance_watchdog_snapshots order by generated_at desc limit 20
  \`;
  return {...state,rationale:state?.lastReason?[String(state.lastReason)]:[],recent};
 }catch{return {status:'UNKNOWN',staleCyclesFound:0,staleCyclesRecovered:0,expiredLocksCleared:0,leaseLossCount:0,rationale:[],recent:[]}}
}
