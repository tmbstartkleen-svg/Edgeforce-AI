import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{r as n}from"./preventiveProbationPerformance-DwhqZeeb.js";import{n as r}from"./preventiveChampionBaseline-CxqOD8Ok.js";import{r as i}from"./preventiveChampionBaselineHealth-DP0O6LOy.js";import{r as a}from"./preventiveBaselineSuccession-DEO5-y_E.js";import{r as o}from"./preventiveBaselineHandoff-rMyDc0St.js";import{r as s}from"./preventiveSuccessorValidation-CDmbX1sP.js";import{r as c}from"./preventiveSuccessorGraduation-BkyShUEC.js";import{r as l}from"./preventiveBaselineConsistency-NcSE0Y1E.js";import{i as u,r as d}from"./preventiveBaselineGovernanceWatchdog-CWNvs3q4.js";function f(e=new Date){let n=new Date(e);return n.setUTCSeconds(0,0),`${t.modelVersion}:${n.toISOString()}`}function p(e){return e.alreadyCompleted?{status:`SKIPPED_IDEMPOTENT`,run:!1,reason:`This governance cycle already completed.`}:e.lockAvailable?{status:`ACQUIRED`,run:!0,reason:`Governance cycle lease acquired.`}:{status:`SKIPPED_LOCKED`,run:!1,reason:`Another governance cycle holds the active lease.`}}async function m(t){let n=e();return n?(await n`select 1 from preventive_baseline_governance_cycles where cycle_key=${t} and status='COMPLETED' limit 1`).length>0:!1}async function h(n){let r=e();if(!r)return{acquired:!1,token:null};let i=await r`
  update preventive_baseline_governance_lock
  set lock_token=${`${t.modelVersion}:${Date.now()}:${Math.random().toString(36).slice(2)}`},locked_until=now()+interval '90 seconds',
   holder_model_version=${t.modelVersion},cycle_key=${n},updated_at=now()
  where singleton_key=1 and (locked_until is null or locked_until<now())
  returning lock_token
 `;return{acquired:i.length===1,token:i?.[0]?.lock_token?String(i[0].lock_token):null}}async function g(t,n){let r=e();return!r||!t||!(await r`
  update preventive_baseline_governance_lock
  set locked_until=now()+interval '90 seconds',updated_at=now()
  where singleton_key=1 and lock_token=${t} and cycle_key=${n} and locked_until>now()
  returning lock_token
 `).length?!1:(await r`
  update preventive_baseline_governance_cycles
  set heartbeat_at=now()
  where cycle_key=${n} and status='STARTED' and lock_token=${t}
 `,!0)}async function _(t){let n=e();!n||!t||await n`
  update preventive_baseline_governance_lock
  set lock_token=null,locked_until=null,holder_model_version=null,cycle_key=null,updated_at=now()
  where singleton_key=1 and lock_token=${t}
 `}async function v(n,r){let i=e();i&&await i`
  insert into preventive_baseline_governance_cycles(cycle_key,model_version,status,lock_token,heartbeat_at)
  values(${n},${t.modelVersion},'STARTED',${r},now())
  on conflict(cycle_key) do update set
   status='STARTED',lock_token=excluded.lock_token,started_at=now(),heartbeat_at=now(),completed_at=null,error_text=null
 `}async function y(t,n,r,i){let a=e();a&&await a`
  update preventive_baseline_governance_cycles
  set status=${n},completed_at=now(),step_results=${a.json(r)},error_text=${i||null}
  where cycle_key=${t}
 `}async function b(){let t=e(),b=f();if(!t)return{configured:!1,cycleKey:b,status:`FAILED`,reason:`Database is not configured.`,steps:{}};if(await u().catch(()=>({configured:!1,status:`FAILED`})),await m(b))return{configured:!0,cycleKey:b,status:`SKIPPED_IDEMPOTENT`,reason:`This governance cycle already completed.`,steps:{}};let x=await h(b),S=p({alreadyCompleted:!1,lockAvailable:x.acquired});if(!S.run)return{configured:!0,cycleKey:b,status:S.status,reason:S.reason,steps:{}};let C={};await v(b,x.token);let w=async(e,t)=>{if(!await g(x.token,b)){let t=`V95 governance lease lost before `+e+`.`;throw await d(t).catch(()=>({recorded:!1})),Error(t)}let n=await t();return C[e]=n,n};try{if(await w(`championHealth`,i),await w(`succession`,a),await w(`handoff`,o),await w(`successorValidation`,s),await w(`successorGraduation`,c),await w(`consistency`,l),await w(`probationPerformance`,n),await w(`championPromotion`,r),!await g(x.token,b)){let e=`V95 governance lease lost before cycle completion.`;throw await d(e).catch(()=>({recorded:!1})),Error(e)}return await y(b,`COMPLETED`,C),{configured:!0,cycleKey:b,status:`COMPLETED`,reason:`Governance cycle completed under a single lease.`,steps:C}}catch(e){let t=e instanceof Error?e.message:`baseline governance cycle failed`;return await y(b,`FAILED`,C,t).catch(()=>void 0),{configured:!0,cycleKey:b,status:`FAILED`,reason:t,steps:C}}finally{await _(x.token).catch(()=>void 0)}}async function x(){let t=e();if(!t)return{status:`UNCONFIGURED`,cycleKey:null,lockActive:!1,recent:[]};try{let[e]=await t`
   select lock_token as "lockToken",locked_until as "lockedUntil",holder_model_version as "holderModelVersion",cycle_key as "cycleKey"
   from preventive_baseline_governance_lock where singleton_key=1
  `,n=await t`
   select id,cycle_key as "cycleKey",model_version as "modelVersion",status,started_at as "startedAt",
    completed_at as "completedAt",error_text as "errorText"
   from preventive_baseline_governance_cycles order by started_at desc limit 20
  `,r=n[0];return{status:String(r?.status||`IDLE`),cycleKey:r?.cycleKey||null,lockActive:!!(e?.lockedUntil&&new Date(e.lockedUntil).getTime()>Date.now()),lockHolder:e?.holderModelVersion||null,lockedUntil:e?.lockedUntil||null,recent:n}}catch{return{status:`IDLE`,cycleKey:null,lockActive:!1,recent:[]}}}export{x as n,b as r,p as t};