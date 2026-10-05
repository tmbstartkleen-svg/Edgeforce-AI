import {db} from './db';
import {loadThresholdProbationSummary} from './preventiveThresholdProbation';
import {loadProbationPerformanceSummary} from './preventiveProbationPerformance';
import {loadPreventiveDecisionCalibrationSummary} from './preventiveDecisionCalibration';
import {RELEASE} from './releaseManifest';

export function shouldPromoteChampionBaseline(input:{
 probationState:string;
 probationStage:number;
 performanceStatus:string;
 degradationScore:number;
 calibrationError:number;
 brierScore:number;
 sampleSize:number;
}){
 const rationale:string[]=[];
 const eligible=
  input.probationState==='FULL'&&
  input.probationStage>=4&&
  input.performanceStatus==='STABLE'&&
  input.degradationScore<.30&&
  input.calibrationError<=.10&&
  input.brierScore<=.20&&
  input.sampleSize>=20;
 if(eligible)rationale.push('Full staged rollout completed with stable performance and mature calibration evidence.');
 else rationale.push('Champion baseline promotion criteria are not yet satisfied.');
 return {eligible,rationale};
}

export async function runChampionBaselineGovernor(){
 const sql=db();
 const [probation,performance,calibration]=await Promise.all([
  loadThresholdProbationSummary(),loadProbationPerformanceSummary(),loadPreventiveDecisionCalibrationSummary()
 ]);
 const decision=shouldPromoteChampionBaseline({
  probationState:String(probation?.state||'INACTIVE'),
  probationStage:Number(probation?.stage||0),
  performanceStatus:String(performance?.status||'INACTIVE'),
  degradationScore:Number(performance?.degradationScore||0),
  calibrationError:Number((calibration as any)?.calibrationError||0),
  brierScore:Number((calibration as any)?.brierScore||0),
  sampleSize:Number((calibration as any)?.sampleSize||0)
 });
 const report={
  ...decision,
  calibrationError:Number((calibration as any)?.calibrationError||0),
  brierScore:Number((calibration as any)?.brierScore||0),
  sampleSize:Number((calibration as any)?.sampleSize||0),
  probationState:String(probation?.state||'INACTIVE'),
  probationStage:Number(probation?.stage||0)
 };
 if(!sql)return {configured:false,promoted:false,...report};
 let promoted=false;
 if(report.eligible){
  await sql`
   insert into preventive_champion_baseline_state(
    singleton_key,calibration_error,brier_score,sample_size,source,promoted_from_stage,promoted_at,rationale,updated_at
   ) values(
    1,${report.calibrationError},${report.brierScore},${report.sampleSize},'FULL_PROBATION_CHAMPION',
    ${report.probationStage},now(),${sql.json(report.rationale)},now()
   )
   on conflict(singleton_key) do update set
    calibration_error=excluded.calibration_error,brier_score=excluded.brier_score,sample_size=excluded.sample_size,
    source=excluded.source,promoted_from_stage=excluded.promoted_from_stage,promoted_at=excluded.promoted_at,
    rationale=excluded.rationale,updated_at=now()
  `;
  await sql`
   insert into preventive_champion_baseline_snapshots(
    model_version,calibration_error,brier_score,sample_size,source,promoted_from_stage,rationale
   ) values(
    ${RELEASE.modelVersion},${report.calibrationError},${report.brierScore},${report.sampleSize},
    'FULL_PROBATION_CHAMPION',${report.probationStage},${sql.json(report.rationale)}
   )
  `;
  promoted=true;
 }
 return {configured:true,promoted,...report};
}

export async function loadChampionBaselineSummary(){
 const sql=db();if(!sql)return {source:'RECOVERY_BASELINE',calibrationError:0,brierScore:0,sampleSize:0,promotedAt:null,rationale:[],recent:[]};
 try{
  const [state]=await sql`
   select calibration_error::float as "calibrationError",brier_score::float as "brierScore",sample_size as "sampleSize",
    source,promoted_from_stage as "promotedFromStage",promoted_at as "promotedAt",rationale
   from preventive_champion_baseline_state where singleton_key=1
  `;
  const recent=await sql`
   select id,calibration_error::float as "calibrationError",brier_score::float as "brierScore",
    sample_size as "sampleSize",source,generated_at as "generatedAt"
   from preventive_champion_baseline_snapshots order by generated_at desc limit 20
  `;
  return state?{...state,recent}:{source:'RECOVERY_BASELINE',calibrationError:0,brierScore:0,sampleSize:0,promotedAt:null,rationale:[],recent};
 }catch{return {source:'RECOVERY_BASELINE',calibrationError:0,brierScore:0,sampleSize:0,promotedAt:null,rationale:[],recent:[]}}
}
