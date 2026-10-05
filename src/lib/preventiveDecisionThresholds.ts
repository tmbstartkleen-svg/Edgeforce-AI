import {db} from './db';
import {loadPreventiveDecisionCalibrationSummary} from './preventiveDecisionCalibration';
import {RELEASE} from './releaseManifest';
import {adaptiveThresholdReentryAllowed} from './preventiveThresholdRecovery';

export type PreventiveDecisionThresholds={
 recommendThreshold:number;
 confidenceFloor:number;
 riskFloor:number;
 rejectEffectivenessCeiling:number;
 sourceSampleSize:number;
 sourceBrierScore:number;
 sourceCalibrationError:number;
 mode:'BASELINE'|'CONSERVATIVE'|'TUNED';
 rationale:string[];
};

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

export function derivePreventiveDecisionThresholds(input:{
 sampleSize:number;
 brierScore:number;
 calibrationError:number;
 recommendSuccessRate:number;
 rejectSuccessRate:number;
}):PreventiveDecisionThresholds{
 const base={recommendThreshold:.72,confidenceFloor:.45,riskFloor:.60,rejectEffectivenessCeiling:.38};
 const rationale:string[]=[];
 let mode:PreventiveDecisionThresholds['mode']='BASELINE';
 let recommend=base.recommendThreshold;
 let confidence=base.confidenceFloor;
 let risk=base.riskFloor;
 let reject=base.rejectEffectivenessCeiling;

 if(input.sampleSize<12){
  rationale.push('Insufficient calibration history; baseline thresholds retained.');
 }else{
  const poor=input.calibrationError>.15||input.brierScore>.24||input.recommendSuccessRate<.60;
  const strong=input.calibrationError<.08&&input.brierScore<.16&&input.recommendSuccessRate>=.75;
  if(poor){
   mode='CONSERVATIVE';
   recommend+=.06;
   confidence+=.10;
   risk+=.05;
   reject-=.04;
   rationale.push('Calibration quality is weak; thresholds tightened within safety bounds.');
  }else if(strong){
   mode='TUNED';
   recommend-=.02;
   confidence-=.03;
   risk-=.02;
   reject+=input.rejectSuccessRate>=.70?.02:0;
   rationale.push('Calibration is strong; minor bounded tuning applied.');
  }else{
   rationale.push('Calibration is acceptable; baseline thresholds retained.');
  }
 }

 return {
  recommendThreshold:clamp(recommend,.70,.82),
  confidenceFloor:clamp(confidence,.42,.60),
  riskFloor:clamp(risk,.58,.72),
  rejectEffectivenessCeiling:clamp(reject,.30,.42),
  sourceSampleSize:input.sampleSize,
  sourceBrierScore:input.brierScore,
  sourceCalibrationError:input.calibrationError,
  mode,rationale
 };
}

export async function buildPreventiveDecisionThresholds(){
 const c:any=await loadPreventiveDecisionCalibrationSummary();
 return derivePreventiveDecisionThresholds({
  sampleSize:Number(c.sampleSize||0),
  brierScore:Number(c.brierScore||0),
  calibrationError:Number(c.calibrationError||0),
  recommendSuccessRate:Number(c.recommendSuccessRate||0),
  rejectSuccessRate:Number(c.rejectSuccessRate||0)
 });
}

export async function persistPreventiveDecisionThresholds(report:PreventiveDecisionThresholds){
 const sql=db();if(!sql)return {persisted:false};
 await sql`
  insert into preventive_decision_threshold_state(
   singleton_key,recommend_threshold,confidence_floor,risk_floor,reject_effectiveness_ceiling,
   source_sample_size,source_brier_score,source_calibration_error,mode,rationale,updated_at
  ) values(
   1,${report.recommendThreshold},${report.confidenceFloor},${report.riskFloor},${report.rejectEffectivenessCeiling},
   ${report.sourceSampleSize},${report.sourceBrierScore},${report.sourceCalibrationError},${report.mode},
   ${sql.json(report.rationale)},now()
  )
  on conflict(singleton_key) do update set
   recommend_threshold=excluded.recommend_threshold,confidence_floor=excluded.confidence_floor,
   risk_floor=excluded.risk_floor,reject_effectiveness_ceiling=excluded.reject_effectiveness_ceiling,
   source_sample_size=excluded.source_sample_size,source_brier_score=excluded.source_brier_score,
   source_calibration_error=excluded.source_calibration_error,mode=excluded.mode,rationale=excluded.rationale,updated_at=now()
 `;
 await sql`
  insert into preventive_decision_threshold_snapshots(
   model_version,recommend_threshold,confidence_floor,risk_floor,reject_effectiveness_ceiling,
   source_sample_size,source_brier_score,source_calibration_error,mode,rationale
  ) values(
   ${RELEASE.modelVersion},${report.recommendThreshold},${report.confidenceFloor},${report.riskFloor},
   ${report.rejectEffectivenessCeiling},${report.sourceSampleSize},${report.sourceBrierScore},
   ${report.sourceCalibrationError},${report.mode},${sql.json(report.rationale)}
  )
 `;
 return {persisted:true};
}

export async function runPreventiveDecisionThresholdGovernor(){
 const reentryAllowed=await adaptiveThresholdReentryAllowed();
 if(!reentryAllowed){
  const active=await loadPreventiveDecisionThresholds();
  return {...active,persisted:false,reentryAllowed:false,governorState:'RECOVERY_LOCK'};
 }
 const report=await buildPreventiveDecisionThresholds();
 const persistence=await persistPreventiveDecisionThresholds(report);
 return {...report,persistence,reentryAllowed:true,governorState:'ADAPTIVE'};
}

export async function loadPreventiveDecisionThresholds(){
 const sql=db();
 if(!sql)return buildPreventiveDecisionThresholds();
 try{
  const [row]=await sql`
   select recommend_threshold::float as "recommendThreshold",confidence_floor::float as "confidenceFloor",
    risk_floor::float as "riskFloor",reject_effectiveness_ceiling::float as "rejectEffectivenessCeiling",
    source_sample_size as "sourceSampleSize",source_brier_score::float as "sourceBrierScore",
    source_calibration_error::float as "sourceCalibrationError",mode,rationale
   from preventive_decision_threshold_state where singleton_key=1
  `;
  return row?{
   recommendThreshold:Number(row.recommendThreshold),
   confidenceFloor:Number(row.confidenceFloor),
   riskFloor:Number(row.riskFloor),
   rejectEffectivenessCeiling:Number(row.rejectEffectivenessCeiling),
   sourceSampleSize:Number(row.sourceSampleSize||0),
   sourceBrierScore:Number(row.sourceBrierScore||0),
   sourceCalibrationError:Number(row.sourceCalibrationError||0),
   mode:String(row.mode) as PreventiveDecisionThresholds['mode'],
   rationale:Array.isArray(row.rationale)?row.rationale.map(String):[]
  }:buildPreventiveDecisionThresholds();
 }catch{return buildPreventiveDecisionThresholds()}
}
