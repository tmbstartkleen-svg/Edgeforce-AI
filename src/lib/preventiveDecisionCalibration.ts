import {db} from './db';
import {RELEASE} from './releaseManifest';

export type CalibrationSample={
 decision:'RECOMMEND'|'HOLD_FOR_EVIDENCE'|'DO_NOT_USE'|'NO_ACTION';
 gateScore:number;
 calibratedSuccess:boolean;
};

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function buildPreventiveDecisionCalibration(samples:CalibrationSample[]){
 const usable=samples.filter(x=>x.decision!=='NO_ACTION');
 if(!usable.length)return {
  sampleSize:0,brierScore:0,calibrationError:0,
  recommendSuccessRate:0,holdSuccessRate:0,rejectSuccessRate:0,
  profiles:[] as Array<{decision:string;sampleSize:number;meanScore:number;successRate:number;error:number}>
 };
 const groups=['RECOMMEND','HOLD_FOR_EVIDENCE','DO_NOT_USE'] as const;
 const profiles=groups.map(decision=>{
  const rows=usable.filter(x=>x.decision===decision);
  const sampleSize=rows.length;
  const meanScore=sampleSize?rows.reduce((s,x)=>s+x.gateScore,0)/sampleSize:0;
  const successRate=sampleSize?rows.filter(x=>x.calibratedSuccess).length/sampleSize:0;
  return {decision,sampleSize,meanScore,successRate,error:Math.abs(meanScore-successRate)};
 });
 const brierScore=usable.reduce((s,x)=>s+(x.gateScore-(x.calibratedSuccess?1:0))**2,0)/usable.length;
 const calibrationError=profiles.reduce((s,p)=>s+p.error*p.sampleSize,0)/usable.length;
 const rate=(d:string)=>profiles.find(p=>p.decision===d)?.successRate||0;
 return {
  sampleSize:usable.length,
  brierScore:clamp(brierScore),
  calibrationError:clamp(calibrationError),
  recommendSuccessRate:rate('RECOMMEND'),
  holdSuccessRate:rate('HOLD_FOR_EVIDENCE'),
  rejectSuccessRate:rate('DO_NOT_USE'),
  profiles
 };
}

async function evaluatePendingDecisionOutcomes(){
 const sql=db();if(!sql)return {evaluated:0};
 const pending=await sql`
  select s.id,s.predicted_cause as "predictedCause",s.decision,s.action_key as "actionKey",s.gate_score::float as "gateScore",s.generated_at as "generatedAt"
  from preventive_action_decision_snapshots s
  left join preventive_decision_outcomes o on o.decision_snapshot_id=s.id
  where o.id is null and s.generated_at<=now()-interval '24 hours'
  order by s.generated_at asc
  limit 200
 `;
 let evaluated=0;
 for(const row of pending as any[]){
  const incidents=await sql`
   select 1 from incident_attribution_snapshots
   where primary_cause=${String(row.predictedCause)}
    and severity='ACTION'
    and observed_at>${new Date(row.generatedAt).toISOString()}
    and observed_at<=${new Date(row.generatedAt).toISOString()}::timestamptz+interval '24 hours'
   limit 1
  `;
  const matchingActionIncident=(incidents as any[]).length>0;
  const decision=String(row.decision);
  const calibratedSuccess=
   decision==='RECOMMEND'? !matchingActionIncident :
   decision==='DO_NOT_USE'? matchingActionIncident :
   decision==='HOLD_FOR_EVIDENCE'? true :
   true;
  await sql`
   insert into preventive_decision_outcomes(
    decision_snapshot_id,predicted_cause,decision,gate_score,action_key,evaluated_at,matching_action_incident,calibrated_success
   ) values(
    ${Number(row.id)},${String(row.predictedCause)},${decision},${Number(row.gateScore||0)},
    ${row.actionKey?String(row.actionKey):null},now(),${matchingActionIncident},${calibratedSuccess}
   )
   on conflict(decision_snapshot_id) do nothing
  `;
  evaluated++;
 }
 return {evaluated};
}

async function loadSamples():Promise<CalibrationSample[]>{
 const sql=db();if(!sql)return [];
 const rows=await sql`
  select decision,gate_score::float as "gateScore",calibrated_success as "calibratedSuccess"
  from preventive_decision_outcomes
  where evaluated_at is not null and created_at>=now()-interval '90 days'
  order by created_at asc
 `;
 return (rows as any[]).map(row=>({
  decision:String(row.decision) as CalibrationSample['decision'],
  gateScore:Number(row.gateScore||0),
  calibratedSuccess:Boolean(row.calibratedSuccess)
 }));
}

export async function runPreventiveDecisionCalibration(){
 const evaluation=await evaluatePendingDecisionOutcomes();
 const sql=db();if(!sql)return {configured:false,evaluatedNow:evaluation.evaluated,...buildPreventiveDecisionCalibration([])};
 const report=buildPreventiveDecisionCalibration(await loadSamples());
 await sql`
  insert into preventive_decision_calibration_snapshots(
   model_version,sample_size,brier_score,calibration_error,recommend_success_rate,hold_success_rate,reject_success_rate,profiles
  ) values(
   ${RELEASE.modelVersion},${report.sampleSize},${report.brierScore},${report.calibrationError},
   ${report.recommendSuccessRate},${report.holdSuccessRate},${report.rejectSuccessRate},${sql.json(report.profiles as any)}
  )
 `;
 return {configured:true,evaluatedNow:evaluation.evaluated,...report};
}

export async function loadPreventiveDecisionCalibrationSummary(){
 const sql=db();
 if(!sql)return {generatedAt:new Date().toISOString(),...buildPreventiveDecisionCalibration([]),recent:[]};
 try{
  const [latest]=await sql`
   select sample_size as "sampleSize",brier_score::float as "brierScore",calibration_error::float as "calibrationError",
    recommend_success_rate::float as "recommendSuccessRate",hold_success_rate::float as "holdSuccessRate",
    reject_success_rate::float as "rejectSuccessRate",profiles,generated_at as "generatedAt"
   from preventive_decision_calibration_snapshots order by generated_at desc limit 1
  `;
  const recent=await sql`
   select id,sample_size as "sampleSize",brier_score::float as "brierScore",calibration_error::float as "calibrationError",
    generated_at as "generatedAt"
   from preventive_decision_calibration_snapshots order by generated_at desc limit 20
  `;
  return latest?{...latest,recent}:{generatedAt:new Date().toISOString(),...buildPreventiveDecisionCalibration([]),recent};
 }catch{return {generatedAt:new Date().toISOString(),...buildPreventiveDecisionCalibration([]),recent:[]}}
}
