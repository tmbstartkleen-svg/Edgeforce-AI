import {db} from './db';
import {loadChampionBaselineSummary} from './preventiveChampionBaseline';
import {loadBaselineSuccessionSummary} from './preventiveBaselineSuccession';
import {RELEASE} from './releaseManifest';

export function evaluateSuccessorPromotion(input:{
 hasActiveChampion:boolean;
 successionStatus:string;
 readinessScore:number;
 candidateCalibrationError:number;
 candidateBrierScore:number;
 candidateSampleSize:number;
 sourceWindows:number;
}){
 const rationale:string[]=[];
 if(input.hasActiveChampion){
  rationale.push('An active champion baseline already exists; successor promotion is not allowed.');
  return {status:'IDLE' as const,eligible:false,rationale};
 }
 const eligible=
  input.successionStatus==='READY'&&
  input.readinessScore>=.80&&
  input.candidateCalibrationError<=.10&&
  input.candidateBrierScore<=.20&&
  input.candidateSampleSize>=25&&
  input.sourceWindows>=3;
 if(!eligible){
  rationale.push('Successor is not yet strong enough for champion handoff.');
  return {status:'WAITING' as const,eligible:false,rationale};
 }
 rationale.push('READY successor passed strengthened promotion thresholds and may become the new champion baseline.');
 return {status:'PROMOTE' as const,eligible:true,rationale};
}

export async function runBaselineHandoffGovernor(){
 const sql=db();
 const [champion,succession,state]=await Promise.all([
  loadChampionBaselineSummary(),
  loadBaselineSuccessionSummary(),
  sql?sql`select promotion_count as "promotionCount" from preventive_baseline_handoff_state where singleton_key=1`:Promise.resolve([])
 ]);
 const decision=evaluateSuccessorPromotion({
  hasActiveChampion:Boolean(champion?.promotedAt),
  successionStatus:String(succession?.status||'IDLE'),
  readinessScore:Number(succession?.readinessScore||0),
  candidateCalibrationError:Number(succession?.candidateCalibrationError||0),
  candidateBrierScore:Number(succession?.candidateBrierScore||0),
  candidateSampleSize:Number(succession?.candidateSampleSize||0),
  sourceWindows:Number(succession?.sourceWindows||0)
 });
 let promoted=false;
 if(sql&&decision.eligible){
  await sql`
   insert into preventive_champion_baseline_state(
    singleton_key,calibration_error,brier_score,sample_size,source,promoted_from_stage,promoted_at,rationale,updated_at
   ) values(
    1,${Number(succession?.candidateCalibrationError||0)},${Number(succession?.candidateBrierScore||0)},
    ${Number(succession?.candidateSampleSize||0)},'SUCCESSION_CHAMPION',null,now(),
    ${sql.json(decision.rationale)},now()
   )
   on conflict(singleton_key) do update set
    calibration_error=excluded.calibration_error,brier_score=excluded.brier_score,sample_size=excluded.sample_size,
    source=excluded.source,promoted_from_stage=null,promoted_at=excluded.promoted_at,
    rationale=excluded.rationale,updated_at=now()
  `;
  await sql`
   insert into preventive_champion_baseline_snapshots(
    model_version,calibration_error,brier_score,sample_size,source,promoted_from_stage,rationale
   ) values(
    ${RELEASE.modelVersion},${Number(succession?.candidateCalibrationError||0)},
    ${Number(succession?.candidateBrierScore||0)},${Number(succession?.candidateSampleSize||0)},
    'SUCCESSION_CHAMPION',null,${sql.json(decision.rationale)}
   )
  `;
  await sql`
   update preventive_champion_baseline_health_state
   set status='ACTIVE',drift_score=0,age_days=0,retired=false,last_reason='V90 successor promoted to champion baseline.',updated_at=now()
   where singleton_key=1
  `;
  await sql`
   update preventive_baseline_succession_state
   set status='IDLE',last_reason='V90 successor promoted; succession cycle completed.',updated_at=now()
   where singleton_key=1
  `;
  promoted=true;
 }
 const promotionCount=Number((state as any[])?.[0]?.promotionCount||0)+(promoted?1:0);
 const status=promoted?'PROMOTED':decision.status;
 if(sql){
  await sql`
   insert into preventive_baseline_handoff_state(
    singleton_key,status,promoted,source_readiness_score,promoted_calibration_error,
    promoted_brier_score,promoted_sample_size,promotion_count,last_reason,updated_at
   ) values(
    1,${status},${promoted},${Number(succession?.readinessScore||0)},
    ${Number(succession?.candidateCalibrationError||0)},${Number(succession?.candidateBrierScore||0)},
    ${Number(succession?.candidateSampleSize||0)},${promotionCount},${decision.rationale.join(' ')},now()
   )
   on conflict(singleton_key) do update set
    status=excluded.status,promoted=excluded.promoted,source_readiness_score=excluded.source_readiness_score,
    promoted_calibration_error=excluded.promoted_calibration_error,promoted_brier_score=excluded.promoted_brier_score,
    promoted_sample_size=excluded.promoted_sample_size,promotion_count=excluded.promotion_count,
    last_reason=excluded.last_reason,updated_at=now()
  `;
  await sql`
   insert into preventive_baseline_handoff_snapshots(
    model_version,status,promoted,source_readiness_score,calibration_error,brier_score,sample_size,rationale
   ) values(
    ${RELEASE.modelVersion},${status},${promoted},${Number(succession?.readinessScore||0)},
    ${Number(succession?.candidateCalibrationError||0)},${Number(succession?.candidateBrierScore||0)},
    ${Number(succession?.candidateSampleSize||0)},${sql.json(decision.rationale)}
   )
  `;
 }
 return {configured:Boolean(sql),...decision,status,promoted,promotionCount};
}

export async function loadBaselineHandoffSummary(){
 const sql=db();if(!sql)return {status:'IDLE',promoted:false,promotionCount:0,sourceReadinessScore:0,promotedCalibrationError:0,promotedBrierScore:0,promotedSampleSize:0,rationale:[],recent:[]};
 try{
  const [state]=await sql`
   select status,promoted,promotion_count as "promotionCount",
    source_readiness_score::float as "sourceReadinessScore",
    promoted_calibration_error::float as "promotedCalibrationError",
    promoted_brier_score::float as "promotedBrierScore",
    promoted_sample_size as "promotedSampleSize",
    last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_baseline_handoff_state where singleton_key=1
  `;
  const recent=await sql`
   select id,status,promoted,source_readiness_score::float as "sourceReadinessScore",generated_at as "generatedAt"
   from preventive_baseline_handoff_snapshots order by generated_at desc limit 20
  `;
  return {...state,rationale:state?.lastReason?[String(state.lastReason)]:[],recent};
 }catch{return {status:'IDLE',promoted:false,promotionCount:0,sourceReadinessScore:0,promotedCalibrationError:0,promotedBrierScore:0,promotedSampleSize:0,rationale:[],recent:[]}}
}
