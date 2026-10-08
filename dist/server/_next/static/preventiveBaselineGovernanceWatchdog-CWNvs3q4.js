import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{r as n}from"./preventiveBaselineConsistency-NcSE0Y1E.js";function r(e){let t=[];return e.staleCycles>0&&t.push(String(e.staleCycles)+` stale STARTED governance cycle(s) require recovery.`),e.expiredLock&&t.push(`Expired governance lease should be cleared.`),e.leaseLossCount>0&&t.push(String(e.leaseLossCount)+` prior lease-loss event(s) are recorded.`),{status:e.staleCycles>0||e.expiredLock?`RECOVERY_REQUIRED`:e.leaseLossCount>0?`WATCH`:`HEALTHY`,rationale:t}}async function i(t){let n=e();return n?(await n`
  update preventive_baseline_governance_watchdog_state
  set lease_loss_count=lease_loss_count+1,last_reason=${t},updated_at=now()
  where singleton_key=1
 `,{recorded:!0}):{recorded:!1}}async function a(){let i=e();if(!i)return{configured:!1,status:`UNCONFIGURED`,staleCyclesFound:0,staleCyclesRecovered:0,expiredLocksCleared:0,rationale:[`Database is not configured.`]};let a=await i`
  select id,cycle_key as "cycleKey"
  from preventive_baseline_governance_cycles
  where status='STARTED'
   and coalesce(heartbeat_at,started_at)<now()-interval '3 minutes'
  order by started_at asc
  limit 50
 `,[o]=await i`
  select lock_token as "lockToken",locked_until as "lockedUntil"
  from preventive_baseline_governance_lock where singleton_key=1
 `,s=!!(o?.lockToken&&o?.lockedUntil&&new Date(o.lockedUntil).getTime()<Date.now()),[c]=await i`
  select lease_loss_count as "leaseLossCount"
  from preventive_baseline_governance_watchdog_state where singleton_key=1
 `,l=r({staleCycles:a.length,expiredLock:s,leaseLossCount:Number(c?.leaseLossCount||0)}),u=0;s&&(await i`
   update preventive_baseline_governance_lock
   set lock_token=null,locked_until=null,holder_model_version=null,cycle_key=null,updated_at=now()
   where singleton_key=1 and locked_until<now()
  `,u=1);let d=0;for(let e of a)await i`
   update preventive_baseline_governance_cycles
   set status='FAILED',completed_at=now(),
    error_text='V95 watchdog recovered stale STARTED cycle after heartbeat timeout.'
   where id=${Number(e.id)} and status='STARTED'
  `,d++;d>0&&await n().catch(()=>({configured:!1}));let f=d||u?`RECOVERED`:l.status,p=[...l.rationale,...d?[`Recovered `+String(d)+` stale governance cycle(s).`]:[],...u?[`Cleared one expired governance lease.`]:[]];await i`
  insert into preventive_baseline_governance_watchdog_state(
   singleton_key,status,stale_cycles_found,stale_cycles_recovered,expired_locks_cleared,last_reason,updated_at
  ) values(
   1,${f},${a.length},${d},${u},
   ${p.join(` `)},now()
  )
  on conflict(singleton_key) do update set
   status=excluded.status,stale_cycles_found=excluded.stale_cycles_found,
   stale_cycles_recovered=preventive_baseline_governance_watchdog_state.stale_cycles_recovered+excluded.stale_cycles_recovered,
   expired_locks_cleared=preventive_baseline_governance_watchdog_state.expired_locks_cleared+excluded.expired_locks_cleared,
   last_reason=excluded.last_reason,updated_at=now()
 `;let[m]=await i`
  select lease_loss_count as "leaseLossCount",stale_cycles_recovered as "totalRecovered",
   expired_locks_cleared as "totalExpiredLocksCleared"
  from preventive_baseline_governance_watchdog_state where singleton_key=1
 `;return await i`
  insert into preventive_baseline_governance_watchdog_snapshots(
   model_version,status,stale_cycles_found,stale_cycles_recovered,expired_locks_cleared,lease_loss_count,rationale
  ) values(
   ${t.modelVersion},${f},${a.length},${d},${u},
   ${Number(m?.leaseLossCount||0)},${i.json(p)}
  )
 `,{configured:!0,status:f,staleCyclesFound:a.length,staleCyclesRecovered:d,expiredLocksCleared:u,leaseLossCount:Number(m?.leaseLossCount||0),rationale:p}}async function o(){let t=e();if(!t)return{status:`UNCONFIGURED`,staleCyclesFound:0,staleCyclesRecovered:0,expiredLocksCleared:0,leaseLossCount:0,rationale:[],recent:[]};try{let[e]=await t`
   select status,stale_cycles_found as "staleCyclesFound",stale_cycles_recovered as "staleCyclesRecovered",
    expired_locks_cleared as "expiredLocksCleared",lease_loss_count as "leaseLossCount",
    last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_baseline_governance_watchdog_state where singleton_key=1
  `,n=await t`
   select id,status,stale_cycles_found as "staleCyclesFound",stale_cycles_recovered as "staleCyclesRecovered",
    expired_locks_cleared as "expiredLocksCleared",lease_loss_count as "leaseLossCount",generated_at as "generatedAt"
   from preventive_baseline_governance_watchdog_snapshots order by generated_at desc limit 20
  `;return{...e,rationale:e?.lastReason?[String(e.lastReason)]:[],recent:n}}catch{return{status:`UNKNOWN`,staleCyclesFound:0,staleCyclesRecovered:0,expiredLocksCleared:0,leaseLossCount:0,rationale:[],recent:[]}}}export{a as i,o as n,i as r,r as t};