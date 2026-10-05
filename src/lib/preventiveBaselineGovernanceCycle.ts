import {db} from './db';
import {RELEASE} from './releaseManifest';
import {runChampionBaselineHealthGovernor} from './preventiveChampionBaselineHealth';
import {runBaselineSuccessionGovernor} from './preventiveBaselineSuccession';
import {runBaselineHandoffGovernor} from './preventiveBaselineHandoff';
import {runSuccessorValidationGovernor} from './preventiveSuccessorValidation';
import {runSuccessorGraduationGovernor} from './preventiveSuccessorGraduation';
import {runBaselineConsistencyGovernor} from './preventiveBaselineConsistency';
import {runProbationPerformanceGovernor} from './preventiveProbationPerformance';
import {runChampionBaselineGovernor} from './preventiveChampionBaseline';

export type GovernanceCycleStatus='ACQUIRED'|'SKIPPED_LOCKED'|'SKIPPED_IDEMPOTENT'|'COMPLETED'|'FAILED';

function cycleKey(now=new Date()){
 const d=new Date(now);
 d.setUTCSeconds(0,0);
 return `${RELEASE.modelVersion}:${d.toISOString()}`;
}

export function evaluateGovernanceLease(input:{
 alreadyCompleted:boolean;
 lockAvailable:boolean;
}){
 if(input.alreadyCompleted)return {status:'SKIPPED_IDEMPOTENT' as const,run:false,reason:'This governance cycle already completed.'};
 if(!input.lockAvailable)return {status:'SKIPPED_LOCKED' as const,run:false,reason:'Another governance cycle holds the active lease.'};
 return {status:'ACQUIRED' as const,run:true,reason:'Governance cycle lease acquired.'};
}

async function alreadyCompleted(key:string){
 const sql=db();if(!sql)return false;
 const rows=await sql`select 1 from preventive_baseline_governance_cycles where cycle_key=${key} and status='COMPLETED' limit 1`;
 return (rows as any[]).length>0;
}

async function acquireLease(key:string){
 const sql=db();if(!sql)return {acquired:false,token:null as string|null};
 const token=`${RELEASE.modelVersion}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
 const rows=await sql`
  update preventive_baseline_governance_lock
  set lock_token=${token},locked_until=now()+interval '90 seconds',
   holder_model_version=${RELEASE.modelVersion},cycle_key=${key},updated_at=now()
  where singleton_key=1 and (locked_until is null or locked_until<now())
  returning lock_token
 `;
 return {acquired:(rows as any[]).length===1,token:(rows as any[])?.[0]?.lock_token?String((rows as any[])[0].lock_token):null};
}

async function releaseLease(token:string|null){
 const sql=db();if(!sql||!token)return;
 await sql`
  update preventive_baseline_governance_lock
  set lock_token=null,locked_until=null,holder_model_version=null,cycle_key=null,updated_at=now()
  where singleton_key=1 and lock_token=${token}
 `;
}

async function recordStart(key:string,token:string|null){
 const sql=db();if(!sql)return;
 await sql`
  insert into preventive_baseline_governance_cycles(cycle_key,model_version,status,lock_token)
  values(${key},${RELEASE.modelVersion},'STARTED',${token})
  on conflict(cycle_key) do update set
   status='STARTED',lock_token=excluded.lock_token,started_at=now(),completed_at=null,error_text=null
 `;
}

async function recordFinish(key:string,status:'COMPLETED'|'FAILED',steps:Record<string,unknown>,errorText?:string){
 const sql=db();if(!sql)return;
 await sql`
  update preventive_baseline_governance_cycles
  set status=${status},completed_at=now(),step_results=${sql.json(steps as any)},error_text=${errorText||null}
  where cycle_key=${key}
 `;
}

export async function runBaselineGovernanceCycle(){
 const sql=db();
 const key=cycleKey();
 if(!sql){
  return {configured:false,cycleKey:key,status:'FAILED' as GovernanceCycleStatus,reason:'Database is not configured.',steps:{}};
 }
 const completed=await alreadyCompleted(key);
 if(completed)return {configured:true,cycleKey:key,status:'SKIPPED_IDEMPOTENT' as GovernanceCycleStatus,reason:'This governance cycle already completed.',steps:{}};
 const lease=await acquireLease(key);
 const gate=evaluateGovernanceLease({alreadyCompleted:false,lockAvailable:lease.acquired});
 if(!gate.run)return {configured:true,cycleKey:key,status:gate.status,reason:gate.reason,steps:{}};

 const steps:Record<string,unknown>={};
 await recordStart(key,lease.token);
 try{
  steps.championHealth=await runChampionBaselineHealthGovernor();
  steps.succession=await runBaselineSuccessionGovernor();
  steps.handoff=await runBaselineHandoffGovernor();
  steps.successorValidation=await runSuccessorValidationGovernor();
  steps.successorGraduation=await runSuccessorGraduationGovernor();
  steps.consistency=await runBaselineConsistencyGovernor();
  steps.probationPerformance=await runProbationPerformanceGovernor();
  steps.championPromotion=await runChampionBaselineGovernor();
  await recordFinish(key,'COMPLETED',steps);
  return {configured:true,cycleKey:key,status:'COMPLETED' as GovernanceCycleStatus,reason:'Governance cycle completed under a single lease.',steps};
 }catch(error){
  const message=error instanceof Error?error.message:'baseline governance cycle failed';
  await recordFinish(key,'FAILED',steps,message).catch(()=>undefined);
  return {configured:true,cycleKey:key,status:'FAILED' as GovernanceCycleStatus,reason:message,steps};
 }finally{
  await releaseLease(lease.token).catch(()=>undefined);
 }
}

export async function loadBaselineGovernanceCycleSummary(){
 const sql=db();
 if(!sql)return {status:'UNCONFIGURED',cycleKey:null,lockActive:false,recent:[]};
 try{
  const [lock]=await sql`
   select lock_token as "lockToken",locked_until as "lockedUntil",holder_model_version as "holderModelVersion",cycle_key as "cycleKey"
   from preventive_baseline_governance_lock where singleton_key=1
  `;
  const recent=await sql`
   select id,cycle_key as "cycleKey",model_version as "modelVersion",status,started_at as "startedAt",
    completed_at as "completedAt",error_text as "errorText"
   from preventive_baseline_governance_cycles order by started_at desc limit 20
  `;
  const latest=(recent as any[])[0];
  return {
   status:String(latest?.status||'IDLE'),
   cycleKey:latest?.cycleKey||null,
   lockActive:Boolean(lock?.lockedUntil&&new Date(lock.lockedUntil).getTime()>Date.now()),
   lockHolder:lock?.holderModelVersion||null,
   lockedUntil:lock?.lockedUntil||null,
   recent
  };
 }catch{return {status:'IDLE',cycleKey:null,lockActive:false,recent:[]}}
}
