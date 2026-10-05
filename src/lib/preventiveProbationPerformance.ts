import {db} from './db';
import {loadThresholdProbationSummary} from './preventiveThresholdProbation';
import {loadPreventiveDecisionCalibrationSummary} from './preventiveDecisionCalibration';
import {RELEASE} from './releaseManifest';

export function evaluateProbationPerformance(input:{
 baselineCalibrationError:number;
 baselineBrierScore:number;
 currentCalibrationError:number;
 currentBrierScore:number;
 probationStage:number;
 probationState:string;
}){
 const rationale:string[]=[];
 if(input.probationStage<=0||input.probationState==='INACTIVE'){
  return {status:'INACTIVE' as const,degradationScore:0,rollbackStage:null as number|null,rationale:['No active probation stage to evaluate.']};
 }
 const calDelta=Math.max(0,input.currentCalibrationError-input.baselineCalibrationError);
 const brierDelta=Math.max(0,input.currentBrierScore-input.baselineBrierScore);
 const degradationScore=Math.max(
  Math.min(1,calDelta/.10),
  Math.min(1,brierDelta/.12)
 );
 if(degradationScore>=.70){
  const rollbackStage=Math.max(0,input.probationStage-1);
  rationale.push('Probation performance degraded materially versus baseline; roll back one stage.');
  return {status:'ROLLBACK' as const,degradationScore,rollbackStage,rationale};
 }
 if(degradationScore>=.40){
  rationale.push('Probation performance is weaker than baseline; hold the current stage.');
  return {status:'HOLD' as const,degradationScore,rollbackStage:null as number|null,rationale};
 }
 rationale.push('Probation performance remains within baseline tolerance.');
 return {status:'STABLE' as const,degradationScore,rollbackStage:null as number|null,rationale};
}

async function loadBaseline(){
 const sql=db();if(!sql)return null;
 try{
  const [champion]=await sql`
   select calibration_error::float as "calibrationError",brier_score::float as "brierScore"
   from preventive_champion_baseline_state where singleton_key=1 and promoted_at is not null
  `;
  if(champion)return champion;
  const [row]=await sql`
   select calibration_error::float as "calibrationError",brier_score::float as "brierScore"
   from preventive_threshold_recovery_snapshots
   where adaptive_reentry_allowed=true
   order by generated_at asc limit 1
  `;
  return row||null;
 }catch{return null}
}

export async function runProbationPerformanceGovernor(){
 const sql=db();
 const [probation,calibration,baseline,state]=await Promise.all([
  loadThresholdProbationSummary(),
  loadPreventiveDecisionCalibrationSummary(),
  loadBaseline(),
  sql?sql`select rollback_count as "rollbackCount" from preventive_probation_performance_state where singleton_key=1`:Promise.resolve([])
 ]);
 const result=evaluateProbationPerformance({
  baselineCalibrationError:Number(baseline?.calibrationError??(calibration as any)?.calibrationError??0),
  baselineBrierScore:Number(baseline?.brierScore??(calibration as any)?.brierScore??0),
  currentCalibrationError:Number((calibration as any)?.calibrationError||0),
  currentBrierScore:Number((calibration as any)?.brierScore||0),
  probationStage:Number(probation?.stage||0),
  probationState:String(probation?.state||'INACTIVE')
 });
 let rollbackApplied=false;
 if(sql&&result.status==='ROLLBACK'&&result.rollbackStage!==null){
  const stage=result.rollbackStage;
  const nextState=stage<=0?'REVERTED':stage===1?'STAGE_1':stage===2?'STAGE_2':'STAGE_3';
  const weight=stage<=0?0:stage===1?.25:stage===2?.50:.75;
  await sql`
   update preventive_threshold_probation_state
   set state=${nextState},stage=${stage},stage_streak=0,adaptive_weight=${weight},
    last_reason='V86 probation performance rollback applied.',updated_at=now()
   where singleton_key=1
  `;
  rollbackApplied=true;
 }
 const rollbackCount=Number((state as any[])?.[0]?.rollbackCount||0)+(rollbackApplied?1:0);
 if(sql){
  await sql`
   insert into preventive_probation_performance_state(
    singleton_key,status,baseline_calibration_error,baseline_brier_score,current_calibration_error,current_brier_score,
    degradation_score,stage_rollback_applied,rollback_count,last_reason,updated_at
   ) values(
    1,${result.status},${Number(baseline?.calibrationError??0)},${Number(baseline?.brierScore??0)},
    ${Number((calibration as any)?.calibrationError||0)},${Number((calibration as any)?.brierScore||0)},
    ${result.degradationScore},${rollbackApplied},${rollbackCount},${result.rationale.join(' ')},now()
   )
   on conflict(singleton_key) do update set
    status=excluded.status,baseline_calibration_error=excluded.baseline_calibration_error,
    baseline_brier_score=excluded.baseline_brier_score,current_calibration_error=excluded.current_calibration_error,
    current_brier_score=excluded.current_brier_score,degradation_score=excluded.degradation_score,
    stage_rollback_applied=excluded.stage_rollback_applied,rollback_count=excluded.rollback_count,
    last_reason=excluded.last_reason,updated_at=now()
  `;
  await sql`
   insert into preventive_probation_performance_snapshots(
    model_version,probation_state,probation_stage,adaptive_weight,status,degradation_score,rollback_applied,rationale
   ) values(
    ${RELEASE.modelVersion},${String(probation?.state||'INACTIVE')},${Number(probation?.stage||0)},
    ${Number(probation?.adaptiveWeight||0)},${result.status},${result.degradationScore},
    ${rollbackApplied},${sql.json(result.rationale)}
   )
  `;
 }
 return {configured:Boolean(sql),...result,rollbackApplied,rollbackCount};
}

export async function loadProbationPerformanceSummary(){
 const sql=db();if(!sql)return {status:'INACTIVE',degradationScore:0,rollbackCount:0,stageRollbackApplied:false,rationale:[],recent:[]};
 try{
  const [state]=await sql`
   select status,degradation_score::float as "degradationScore",rollback_count as "rollbackCount",
    stage_rollback_applied as "stageRollbackApplied",last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_probation_performance_state where singleton_key=1
  `;
  const recent=await sql`
   select id,probation_state as "probationState",probation_stage as "probationStage",
    adaptive_weight::float as "adaptiveWeight",status,degradation_score::float as "degradationScore",
    rollback_applied as "rollbackApplied",generated_at as "generatedAt"
   from preventive_probation_performance_snapshots order by generated_at desc limit 20
  `;
  return {...state,rationale:state?.lastReason?[String(state.lastReason)]:[],recent};
 }catch{return {status:'INACTIVE',degradationScore:0,rollbackCount:0,stageRollbackApplied:false,rationale:[],recent:[]}}
}
