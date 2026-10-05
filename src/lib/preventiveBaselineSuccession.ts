import {db} from './db';
import {loadChampionBaselineSummary} from './preventiveChampionBaseline';
import {loadChampionBaselineHealthSummary} from './preventiveChampionBaselineHealth';
import {RELEASE} from './releaseManifest';

type CalibrationWindow={calibrationError:number;brierScore:number;sampleSize:number};

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function evaluateBaselineSuccession(input:{
 hasActiveChampion:boolean;
 championRetired:boolean;
 windows:CalibrationWindow[];
}){
 const rationale:string[]=[];
 if(input.hasActiveChampion&&!input.championRetired){
  return {status:'IDLE' as const,readinessScore:0,candidate:null as null|CalibrationWindow,sourceWindows:0,rationale:['Active champion baseline remains healthy; no successor is needed.']};
 }
 if(input.windows.length<3){
  return {status:'BUILDING' as const,readinessScore:0,candidate:null as null|CalibrationWindow,sourceWindows:input.windows.length,rationale:['At least three recent calibration windows are required to validate a replacement candidate.']};
 }
 const recent=input.windows.slice(-5);
 const meanCal=recent.reduce((s,x)=>s+x.calibrationError,0)/recent.length;
 const meanBrier=recent.reduce((s,x)=>s+x.brierScore,0)/recent.length;
 const sampleSize=recent[recent.length-1]?.sampleSize||0;
 const calSpread=Math.max(...recent.map(x=>x.calibrationError))-Math.min(...recent.map(x=>x.calibrationError));
 const brierSpread=Math.max(...recent.map(x=>x.brierScore))-Math.min(...recent.map(x=>x.brierScore));
 const stability=1-clamp(Math.max(calSpread/.08,brierSpread/.10));
 const quality=1-clamp(Math.max((meanCal-.06)/.12,(meanBrier-.14)/.16));
 const maturity=clamp(sampleSize/30);
 const readinessScore=clamp(stability*.40+quality*.40+maturity*.20);
 const candidate={calibrationError:meanCal,brierScore:meanBrier,sampleSize};
 if(readinessScore>=.75&&meanCal<=.10&&meanBrier<=.20&&sampleSize>=20){
  rationale.push('Replacement baseline is READY: recent windows are stable, healthy, and sufficiently mature.');
  return {status:'READY' as const,readinessScore,candidate,sourceWindows:recent.length,rationale};
 }
 if(readinessScore>=.50){
  rationale.push('Replacement baseline is a CANDIDATE but needs more stability or evidence before use.');
  return {status:'CANDIDATE' as const,readinessScore,candidate,sourceWindows:recent.length,rationale};
 }
 rationale.push('Replacement evidence is not yet strong enough; continue using the recovery baseline fallback.');
 return {status:'BUILDING' as const,readinessScore,candidate,sourceWindows:recent.length,rationale};
}

async function loadRecentCalibrationWindows():Promise<CalibrationWindow[]>{
 const sql=db();if(!sql)return [];
 const rows=await sql`
  select calibration_error::float as "calibrationError",brier_score::float as "brierScore",sample_size as "sampleSize"
  from preventive_decision_calibration_snapshots
  order by generated_at desc limit 5
 `;
 return (rows as any[]).reverse().map(x=>({
  calibrationError:Number(x.calibrationError||0),
  brierScore:Number(x.brierScore||0),
  sampleSize:Number(x.sampleSize||0)
 }));
}

export async function runBaselineSuccessionGovernor(){
 const sql=db();
 const [champion,health,windows]=await Promise.all([
  loadChampionBaselineSummary(),
  loadChampionBaselineHealthSummary(),
  loadRecentCalibrationWindows()
 ]);
 const report=evaluateBaselineSuccession({
  hasActiveChampion:Boolean(champion?.promotedAt),
  championRetired:Boolean(health?.retired)||String(champion?.source||'').includes('RETIRED'),
  windows
 });
 const candidate=report.candidate;
 if(!sql)return {configured:false,...report};
 await sql`
  insert into preventive_baseline_succession_state(
   singleton_key,status,candidate_calibration_error,candidate_brier_score,candidate_sample_size,
   readiness_score,source_windows,last_reason,updated_at
  ) values(
   1,${report.status},${candidate?.calibrationError||0},${candidate?.brierScore||0},${candidate?.sampleSize||0},
   ${report.readinessScore},${report.sourceWindows},${report.rationale.join(' ')},now()
  )
  on conflict(singleton_key) do update set
   status=excluded.status,candidate_calibration_error=excluded.candidate_calibration_error,
   candidate_brier_score=excluded.candidate_brier_score,candidate_sample_size=excluded.candidate_sample_size,
   readiness_score=excluded.readiness_score,source_windows=excluded.source_windows,
   last_reason=excluded.last_reason,updated_at=now()
 `;
 await sql`
  insert into preventive_baseline_succession_snapshots(
   model_version,status,candidate_calibration_error,candidate_brier_score,candidate_sample_size,
   readiness_score,source_windows,rationale
  ) values(
   ${RELEASE.modelVersion},${report.status},${candidate?.calibrationError||0},${candidate?.brierScore||0},
   ${candidate?.sampleSize||0},${report.readinessScore},${report.sourceWindows},${sql.json(report.rationale)}
  )
 `;
 return {configured:true,...report};
}

export async function loadBaselineSuccessionSummary(){
 const sql=db();if(!sql)return {status:'IDLE',readinessScore:0,candidateCalibrationError:0,candidateBrierScore:0,candidateSampleSize:0,sourceWindows:0,rationale:[],recent:[]};
 try{
  const [state]=await sql`
   select status,candidate_calibration_error::float as "candidateCalibrationError",
    candidate_brier_score::float as "candidateBrierScore",candidate_sample_size as "candidateSampleSize",
    readiness_score::float as "readinessScore",source_windows as "sourceWindows",
    last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_baseline_succession_state where singleton_key=1
  `;
  const recent=await sql`
   select id,status,readiness_score::float as "readinessScore",source_windows as "sourceWindows",generated_at as "generatedAt"
   from preventive_baseline_succession_snapshots order by generated_at desc limit 20
  `;
  return {...state,rationale:state?.lastReason?[String(state.lastReason)]:[],recent};
 }catch{return {status:'IDLE',readinessScore:0,candidateCalibrationError:0,candidateBrierScore:0,candidateSampleSize:0,sourceWindows:0,rationale:[],recent:[]}}
}
