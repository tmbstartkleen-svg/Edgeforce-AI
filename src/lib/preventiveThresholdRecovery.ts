import {db} from './db';
import {loadThresholdStabilitySummary} from './preventiveThresholdStability';
import {loadPreventiveDecisionCalibrationSummary} from './preventiveDecisionCalibration';
import {RELEASE} from './releaseManifest';

export type ThresholdRecoveryState='OPEN'|'LOCKED'|'RECOVERING';

export type ThresholdRecoverySummary={
 state:ThresholdRecoveryState;
 recoveryStreak:number;
 rollbackReferenceId:number|null;
 adaptiveReentryAllowed:boolean;
 rationale:string[];
 updatedAt:string|null;
 recent:any[];
};

export function nextThresholdRecoveryState(input:{
 previousState:ThresholdRecoveryState;
 recoveryStreak:number;
 rollbackApplied:boolean;
 instabilityScore:number;
 calibrationError:number;
 brierScore:number;
 sampleSize:number;
}){
 const rationale:string[]=[];
 if(input.rollbackApplied||input.instabilityScore>=.72){
  rationale.push('Threshold rollback or severe instability detected; adaptive tuning is locked.');
  return {state:'LOCKED' as const,recoveryStreak:0,adaptiveReentryAllowed:false,rationale};
 }
 const healthy=
  input.sampleSize>=12&&
  input.instabilityScore<.35&&
  input.calibrationError<=.10&&
  input.brierScore<=.20;

 if(input.previousState==='LOCKED'){
  if(!healthy){
   rationale.push('Recovery evidence is not yet strong enough to leave the locked state.');
   return {state:'LOCKED' as const,recoveryStreak:0,adaptiveReentryAllowed:false,rationale};
  }
  rationale.push('First healthy recovery window passed; entering monitored recovery.');
  return {state:'RECOVERING' as const,recoveryStreak:1,adaptiveReentryAllowed:false,rationale};
 }

 if(input.previousState==='RECOVERING'){
  if(!healthy){
   rationale.push('Recovery evidence regressed; adaptive tuning is locked again.');
   return {state:'LOCKED' as const,recoveryStreak:0,adaptiveReentryAllowed:false,rationale};
  }
  const streak=input.recoveryStreak+1;
  if(streak>=3){
   rationale.push('Three consecutive healthy recovery windows passed; bounded adaptive tuning may resume.');
   return {state:'OPEN' as const,recoveryStreak:streak,adaptiveReentryAllowed:true,rationale};
  }
  rationale.push(`Healthy recovery window ${streak}/3 passed.`);
  return {state:'RECOVERING' as const,recoveryStreak:streak,adaptiveReentryAllowed:false,rationale};
 }

 rationale.push(healthy?'Adaptive threshold tuning remains open under healthy evidence.':'Evidence is below re-entry quality targets, but no active rollback lock exists.');
 return {state:'OPEN' as const,recoveryStreak:0,adaptiveReentryAllowed:true,rationale};
}

async function loadPersistedRecovery(){
 const sql=db();if(!sql)return null;
 try{
  const [row]=await sql`
   select state,recovery_streak as "recoveryStreak",rollback_reference_id as "rollbackReferenceId",
    adaptive_reentry_allowed as "adaptiveReentryAllowed",last_reason as "lastReason"
   from preventive_threshold_recovery_state where singleton_key=1
  `;
  return row||null;
 }catch{return null}
}

export async function runThresholdRecoveryGovernor(){
 const sql=db();
 const [stability,calibration,previous]=await Promise.all([
  loadThresholdStabilitySummary(),
  loadPreventiveDecisionCalibrationSummary(),
  loadPersistedRecovery()
 ]);
 const transition=nextThresholdRecoveryState({
  previousState:String(previous?.state||'OPEN') as ThresholdRecoveryState,
  recoveryStreak:Number(previous?.recoveryStreak||0),
  rollbackApplied:Boolean(stability?.rollbackApplied),
  instabilityScore:Number(stability?.instabilityScore||0),
  calibrationError:Number((calibration as any)?.calibrationError||0),
  brierScore:Number((calibration as any)?.brierScore||0),
  sampleSize:Number((calibration as any)?.sampleSize||0)
 });
 const report={
  ...transition,
  calibrationError:Number((calibration as any)?.calibrationError||0),
  brierScore:Number((calibration as any)?.brierScore||0),
  sampleSize:Number((calibration as any)?.sampleSize||0),
  instabilityScore:Number(stability?.instabilityScore||0),
  rollbackReferenceId:stability?.lastSafeSnapshotId?Number(stability.lastSafeSnapshotId):null
 };
 if(!sql)return {configured:false,...report};
 await sql`
  insert into preventive_threshold_recovery_state(
   singleton_key,state,recovery_streak,rollback_reference_id,adaptive_reentry_allowed,last_reason,updated_at
  ) values(
   1,${report.state},${report.recoveryStreak},${report.rollbackReferenceId},
   ${report.adaptiveReentryAllowed},${report.rationale.join(' ')},now()
  )
  on conflict(singleton_key) do update set
   state=excluded.state,recovery_streak=excluded.recovery_streak,
   rollback_reference_id=excluded.rollback_reference_id,adaptive_reentry_allowed=excluded.adaptive_reentry_allowed,
   last_reason=excluded.last_reason,updated_at=now()
 `;
 await sql`
  insert into preventive_threshold_recovery_snapshots(
   model_version,state,recovery_streak,rollback_reference_id,adaptive_reentry_allowed,
   calibration_error,brier_score,instability_score,rationale
  ) values(
   ${RELEASE.modelVersion},${report.state},${report.recoveryStreak},${report.rollbackReferenceId},
   ${report.adaptiveReentryAllowed},${report.calibrationError},${report.brierScore},
   ${report.instabilityScore},${sql.json(report.rationale)}
  )
 `;
 return {configured:true,...report};
}

export async function loadThresholdRecoverySummary():Promise<ThresholdRecoverySummary>{
 const sql=db();
 if(!sql)return {state:'OPEN',recoveryStreak:0,rollbackReferenceId:null,adaptiveReentryAllowed:true,rationale:['Database is not configured.'],updatedAt:null,recent:[]};
 try{
  const [state]=await sql`
   select state,recovery_streak as "recoveryStreak",rollback_reference_id as "rollbackReferenceId",
    adaptive_reentry_allowed as "adaptiveReentryAllowed",last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_threshold_recovery_state where singleton_key=1
  `;
  const recent=await sql`
   select id,state,recovery_streak as "recoveryStreak",adaptive_reentry_allowed as "adaptiveReentryAllowed",
    calibration_error::float as "calibrationError",brier_score::float as "brierScore",
    instability_score::float as "instabilityScore",generated_at as "generatedAt"
   from preventive_threshold_recovery_snapshots order by generated_at desc limit 20
  `;
  return {
   state:String(state?.state||'OPEN') as ThresholdRecoveryState,
   recoveryStreak:Number(state?.recoveryStreak||0),
   rollbackReferenceId:state?.rollbackReferenceId==null?null:Number(state.rollbackReferenceId),
   adaptiveReentryAllowed:state?.adaptiveReentryAllowed!==false,
   rationale:state?.lastReason?[String(state.lastReason)]:[],
   updatedAt:state?.updatedAt?new Date(state.updatedAt).toISOString():null,
   recent:recent as any[]
  };
 }catch{return {state:'OPEN',recoveryStreak:0,rollbackReferenceId:null,adaptiveReentryAllowed:true,rationale:[],updatedAt:null,recent:[]}}
}

export async function adaptiveThresholdReentryAllowed(){
 const summary=await loadThresholdRecoverySummary();
 return summary?.adaptiveReentryAllowed!==false;
}
