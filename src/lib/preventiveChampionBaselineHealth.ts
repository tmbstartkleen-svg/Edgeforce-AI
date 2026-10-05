import {db} from './db';
import {loadChampionBaselineSummary} from './preventiveChampionBaseline';
import {loadPreventiveDecisionCalibrationSummary} from './preventiveDecisionCalibration';
import {RELEASE} from './releaseManifest';

export function evaluateChampionBaselineHealth(input:{
 championCalibrationError:number;
 championBrierScore:number;
 currentCalibrationError:number;
 currentBrierScore:number;
 ageDays:number;
 hasChampion:boolean;
}){
 const rationale:string[]=[];
 if(!input.hasChampion)return {status:'NO_CHAMPION' as const,driftScore:0,retire:false,rationale:['No promoted champion baseline is active.']};
 const calibrationDrift=Math.max(0,input.currentCalibrationError-input.championCalibrationError);
 const brierDrift=Math.max(0,input.currentBrierScore-input.championBrierScore);
 const qualityDrift=Math.max(Math.min(1,calibrationDrift/.10),Math.min(1,brierDrift/.12));
 const agePenalty=input.ageDays>=60?1:input.ageDays>=30?.5:0;
 const driftScore=Math.max(qualityDrift,agePenalty*.6);
 if(driftScore>=.75){
  rationale.push('Champion baseline is stale or materially misaligned with current calibration and should be retired.');
  return {status:'RETIRE' as const,driftScore,retire:true,rationale};
 }
 if(driftScore>=.40){
  rationale.push('Champion baseline drift is elevated; continue monitoring before retirement.');
  return {status:'WATCH' as const,driftScore,retire:false,rationale};
 }
 rationale.push('Champion baseline remains aligned with current healthy calibration.');
 return {status:'ACTIVE' as const,driftScore,retire:false,rationale};
}

export async function runChampionBaselineHealthGovernor(){
 const sql=db();
 const [champion,calibration,state]=await Promise.all([
  loadChampionBaselineSummary(),
  loadPreventiveDecisionCalibrationSummary(),
  sql?sql`select retirement_count as "retirementCount" from preventive_champion_baseline_health_state where singleton_key=1`:Promise.resolve([])
 ]);
 const promotedAt=champion?.promotedAt?new Date(champion.promotedAt):null;
 const ageDays=promotedAt?Math.max(0,(Date.now()-promotedAt.getTime())/86400000):0;
 const result=evaluateChampionBaselineHealth({
  championCalibrationError:Number(champion?.calibrationError||0),
  championBrierScore:Number(champion?.brierScore||0),
  currentCalibrationError:Number((calibration as any)?.calibrationError||0),
  currentBrierScore:Number((calibration as any)?.brierScore||0),
  ageDays,
  hasChampion:Boolean(champion?.promotedAt)
 });
 let retired=false;
 if(sql&&result.retire){
  await sql`
   update preventive_champion_baseline_state
   set source='RETIRED_CHAMPION',promoted_at=null,rationale=${sql.json(result.rationale)},updated_at=now()
   where singleton_key=1
  `;
  retired=true;
 }
 const retirementCount=Number((state as any[])?.[0]?.retirementCount||0)+(retired?1:0);
 if(sql){
  await sql`
   insert into preventive_champion_baseline_health_state(
    singleton_key,status,drift_score,age_days,retired,retirement_count,last_reason,updated_at
   ) values(
    1,${result.status},${result.driftScore},${ageDays},${retired},${retirementCount},${result.rationale.join(' ')},now()
   )
   on conflict(singleton_key) do update set
    status=excluded.status,drift_score=excluded.drift_score,age_days=excluded.age_days,
    retired=excluded.retired,retirement_count=excluded.retirement_count,last_reason=excluded.last_reason,updated_at=now()
  `;
  await sql`
   insert into preventive_champion_baseline_health_snapshots(
    model_version,status,drift_score,age_days,retired,
    champion_calibration_error,champion_brier_score,current_calibration_error,current_brier_score,rationale
   ) values(
    ${RELEASE.modelVersion},${result.status},${result.driftScore},${ageDays},${retired},
    ${Number(champion?.calibrationError||0)},${Number(champion?.brierScore||0)},
    ${Number((calibration as any)?.calibrationError||0)},${Number((calibration as any)?.brierScore||0)},
    ${sql.json(result.rationale)}
   )
  `;
 }
 return {configured:Boolean(sql),...result,retired,retirementCount,ageDays};
}

export async function loadChampionBaselineHealthSummary(){
 const sql=db();if(!sql)return {status:'NO_CHAMPION',driftScore:0,ageDays:0,retired:false,retirementCount:0,rationale:[],recent:[]};
 try{
  const [state]=await sql`
   select status,drift_score::float as "driftScore",age_days::float as "ageDays",retired,
    retirement_count as "retirementCount",last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_champion_baseline_health_state where singleton_key=1
  `;
  const recent=await sql`
   select id,status,drift_score::float as "driftScore",age_days::float as "ageDays",retired,generated_at as "generatedAt"
   from preventive_champion_baseline_health_snapshots order by generated_at desc limit 20
  `;
  return {...state,rationale:state?.lastReason?[String(state.lastReason)]:[],recent};
 }catch{return {status:'NO_CHAMPION',driftScore:0,ageDays:0,retired:false,retirementCount:0,rationale:[],recent:[]}}
}
