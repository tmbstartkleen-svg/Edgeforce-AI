import {db} from './db';
import {loadThresholdRecoverySummary} from './preventiveThresholdRecovery';
import {loadThresholdStabilitySummary} from './preventiveThresholdStability';
import {loadPreventiveDecisionCalibrationSummary} from './preventiveDecisionCalibration';
import {RELEASE} from './releaseManifest';

export type ThresholdProbationState='INACTIVE'|'STAGE_1'|'STAGE_2'|'STAGE_3'|'FULL'|'REVERTED';

export function nextThresholdProbationState(input:{
 previousState:ThresholdProbationState;
 stageStreak:number;
 reentryAllowed:boolean;
 recoveryState:string;
 rollbackReferenceId?:number|null;
 instabilityScore:number;
 calibrationError:number;
 brierScore:number;
 sampleSize:number;
}){
 const rationale:string[]=[];
 if(!input.rollbackReferenceId&&input.previousState==='INACTIVE'){
  rationale.push('No rollback recovery is active; full bounded adaptive influence remains enabled.');
  return {state:'FULL' as const,stage:4,stageStreak:0,adaptiveWeight:1,rationale};
 }
 if(!input.reentryAllowed||input.recoveryState!=='OPEN'){
  rationale.push('Adaptive re-entry is not open; probation remains inactive.');
  return {state:'INACTIVE' as const,stage:0,stageStreak:0,adaptiveWeight:0,rationale};
 }
 const healthy=input.sampleSize>=12&&input.instabilityScore<.35&&input.calibrationError<=.10&&input.brierScore<=.20;
 if(!healthy&&input.previousState!=='INACTIVE'){
  rationale.push('Probation evidence regressed; adaptive influence reverted to zero.');
  return {state:'REVERTED' as const,stage:0,stageStreak:0,adaptiveWeight:0,rationale};
 }
 if(input.previousState==='INACTIVE'||input.previousState==='REVERTED'){
  rationale.push('Adaptive re-entry begins at 25% influence.');
  return {state:'STAGE_1' as const,stage:1,stageStreak:1,adaptiveWeight:.25,rationale};
 }
 const currentStage=input.previousState==='STAGE_1'?1:input.previousState==='STAGE_2'?2:input.previousState==='STAGE_3'?3:4;
 if(input.previousState==='FULL'){
  rationale.push('Adaptive thresholds are at full bounded influence.');
  return {state:'FULL' as const,stage:4,stageStreak:input.stageStreak,adaptiveWeight:1,rationale};
 }
 const streak=input.stageStreak+1;
 if(streak<2){
  const weight=currentStage===1?.25:currentStage===2?.50:.75;
  rationale.push(`Probation stage ${currentStage} requires another healthy window.`);
  return {state:input.previousState,stage:currentStage,stageStreak:streak,adaptiveWeight:weight,rationale};
 }
 const nextStage=currentStage+1;
 if(nextStage>=4){
  rationale.push('Three staged probation levels passed; full bounded adaptive influence restored.');
  return {state:'FULL' as const,stage:4,stageStreak:0,adaptiveWeight:1,rationale};
 }
 const state=nextStage===2?'STAGE_2':'STAGE_3';
 const weight=nextStage===2?.50:.75;
 rationale.push(`Probation advanced to stage ${nextStage} after sustained healthy evidence.`);
 return {state,stage:nextStage,stageStreak:0,adaptiveWeight:weight,rationale};
}

async function loadPersisted(){
 const sql=db();if(!sql)return null;
 try{
  const [row]=await sql`select state,stage,stage_streak as "stageStreak",adaptive_weight::float as "adaptiveWeight" from preventive_threshold_probation_state where singleton_key=1`;
  return row||null;
 }catch{return null}
}

export async function runThresholdProbationGovernor(){
 const sql=db();
 const [recovery,stability,calibration,previous]=await Promise.all([
  loadThresholdRecoverySummary(),loadThresholdStabilitySummary(),loadPreventiveDecisionCalibrationSummary(),loadPersisted()
 ]);
 const transition=nextThresholdProbationState({
  previousState:String(previous?.state||'INACTIVE') as ThresholdProbationState,
  stageStreak:Number(previous?.stageStreak||0),
  reentryAllowed:recovery?.adaptiveReentryAllowed!==false,
  recoveryState:String(recovery?.state||'OPEN'),
  rollbackReferenceId:recovery?.rollbackReferenceId?Number(recovery.rollbackReferenceId):null,
  instabilityScore:Number(stability?.instabilityScore||0),
  calibrationError:Number((calibration as any)?.calibrationError||0),
  brierScore:Number((calibration as any)?.brierScore||0),
  sampleSize:Number((calibration as any)?.sampleSize||0)
 });
 const report={...transition,
  calibrationError:Number((calibration as any)?.calibrationError||0),
  brierScore:Number((calibration as any)?.brierScore||0),
  instabilityScore:Number(stability?.instabilityScore||0)
 };
 if(!sql)return {configured:false,...report};
 await sql`
  insert into preventive_threshold_probation_state(singleton_key,state,stage,stage_streak,adaptive_weight,last_reason,updated_at)
  values(1,${report.state},${report.stage},${report.stageStreak},${report.adaptiveWeight},${report.rationale.join(' ')},now())
  on conflict(singleton_key) do update set state=excluded.state,stage=excluded.stage,stage_streak=excluded.stage_streak,
   adaptive_weight=excluded.adaptive_weight,last_reason=excluded.last_reason,updated_at=now()
 `;
 await sql`
  insert into preventive_threshold_probation_snapshots(model_version,state,stage,stage_streak,adaptive_weight,calibration_error,brier_score,instability_score,rationale)
  values(${RELEASE.modelVersion},${report.state},${report.stage},${report.stageStreak},${report.adaptiveWeight},
   ${report.calibrationError},${report.brierScore},${report.instabilityScore},${sql.json(report.rationale)})
 `;
 return {configured:true,...report};
}

export async function loadThresholdProbationSummary(){
 const sql=db();if(!sql)return {state:'INACTIVE',stage:0,stageStreak:0,adaptiveWeight:0,rationale:[],recent:[]};
 try{
  const [state]=await sql`select state,stage,stage_streak as "stageStreak",adaptive_weight::float as "adaptiveWeight",last_reason as "lastReason" from preventive_threshold_probation_state where singleton_key=1`;
  const recent=await sql`select id,state,stage,adaptive_weight::float as "adaptiveWeight",generated_at as "generatedAt" from preventive_threshold_probation_snapshots order by generated_at desc limit 20`;
  return {...state,rationale:state?.lastReason?[String(state.lastReason)]:[],recent};
 }catch{return {state:'INACTIVE',stage:0,stageStreak:0,adaptiveWeight:0,rationale:[],recent:[]}}
}

export async function getAdaptiveThresholdWeight(){
 const summary=await loadThresholdProbationSummary();
 if(String(summary?.state||'INACTIVE')==='INACTIVE')return 1;
 return Math.max(0,Math.min(1,Number(summary?.adaptiveWeight||0)));
}
