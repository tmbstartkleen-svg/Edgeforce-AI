import {db} from './db';
import {loadChampionBaselineSummary} from './preventiveChampionBaseline';
import {loadBaselineHandoffSummary} from './preventiveBaselineHandoff';
import {loadPreventiveDecisionCalibrationSummary} from './preventiveDecisionCalibration';
import {RELEASE} from './releaseManifest';

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function evaluateSuccessorValidation(input:{
 championSource:string;
 previousStatus:string;
 previousStreak:number;
 baselineCalibrationError:number;
 baselineBrierScore:number;
 currentCalibrationError:number;
 currentBrierScore:number;
 sampleSize:number;
}){
 const rationale:string[]=[];
 if(input.championSource!=='SUCCESSION_CHAMPION'){
  return {status:'IDLE' as const,validationStreak:0,degradationScore:0,revert:false,rationale:['No succession champion is active.']};
 }
 const calDelta=Math.max(0,input.currentCalibrationError-input.baselineCalibrationError);
 const brierDelta=Math.max(0,input.currentBrierScore-input.baselineBrierScore);
 const degradationScore=clamp(Math.max(calDelta/.08,brierDelta/.10));
 if(input.sampleSize<20){
  rationale.push('Succession champion is active, but post-handoff evidence is still immature.');
  return {status:'VALIDATING' as const,validationStreak:0,degradationScore,revert:false,rationale};
 }
 if(degradationScore>=.70){
  rationale.push('Post-handoff calibration degraded materially; revert the succession champion and return to the safe fallback path.');
  return {status:'REVERT' as const,validationStreak:0,degradationScore,revert:true,rationale};
 }
 const healthy=input.currentCalibrationError<=.10&&input.currentBrierScore<=.20&&degradationScore<.35;
 if(!healthy){
  rationale.push('Post-handoff results are not healthy enough to confirm the new champion; validation streak reset.');
  return {status:'VALIDATING' as const,validationStreak:0,degradationScore,revert:false,rationale};
 }
 const streak=input.previousStatus==='CONFIRMED'?Math.max(3,input.previousStreak):input.previousStreak+1;
 if(streak>=3){
  rationale.push('Three consecutive healthy post-handoff windows passed; succession champion is confirmed.');
  return {status:'CONFIRMED' as const,validationStreak:streak,degradationScore,revert:false,rationale};
 }
 rationale.push(`Healthy post-handoff validation window ${streak}/3 passed.`);
 return {status:'VALIDATING' as const,validationStreak:streak,degradationScore,revert:false,rationale};
}

async function loadPersisted(){
 const sql=db();if(!sql)return null;
 try{
  const [row]=await sql`
   select status,validation_streak as "validationStreak",reversion_count as "reversionCount"
   from preventive_successor_validation_state where singleton_key=1
  `;
  return row||null;
 }catch{return null}
}

export async function runSuccessorValidationGovernor(){
 const sql=db();
 const [champion,handoff,calibration,previous]=await Promise.all([
  loadChampionBaselineSummary(),
  loadBaselineHandoffSummary(),
  loadPreventiveDecisionCalibrationSummary(),
  loadPersisted()
 ]);
 const report=evaluateSuccessorValidation({
  championSource:String(champion?.source||''),
  previousStatus:String(previous?.status||'IDLE'),
  previousStreak:Number(previous?.validationStreak||0),
  baselineCalibrationError:Number(handoff?.promotedCalibrationError||champion?.calibrationError||0),
  baselineBrierScore:Number(handoff?.promotedBrierScore||champion?.brierScore||0),
  currentCalibrationError:Number((calibration as any)?.calibrationError||0),
  currentBrierScore:Number((calibration as any)?.brierScore||0),
  sampleSize:Number((calibration as any)?.sampleSize||0)
 });
 let reverted=false;
 if(sql&&report.revert){
  await sql`
   update preventive_champion_baseline_state
   set source='REVERTED_SUCCESSION_CHAMPION',promoted_at=null,
    rationale=${sql.json(report.rationale)},updated_at=now()
   where singleton_key=1 and source='SUCCESSION_CHAMPION'
  `;
  await sql`
   update preventive_champion_baseline_health_state
   set status='RETIRE',retired=true,last_reason='V91 reverted succession champion after post-handoff degradation.',updated_at=now()
   where singleton_key=1
  `;
  await sql`
   update preventive_baseline_succession_state
   set status='BUILDING',last_reason='V91 reopened succession after failed post-handoff validation.',updated_at=now()
   where singleton_key=1
  `;
  reverted=true;
 }
 const reversionCount=Number(previous?.reversionCount||0)+(reverted?1:0);
 const status=reverted?'REVERTED':report.status;
 if(sql){
  await sql`
   insert into preventive_successor_validation_state(
    singleton_key,status,validation_streak,degradation_score,reverted,reversion_count,last_reason,updated_at
   ) values(
    1,${status},${report.validationStreak},${report.degradationScore},
    ${reverted},${reversionCount},${report.rationale.join(' ')},now()
   )
   on conflict(singleton_key) do update set
    status=excluded.status,validation_streak=excluded.validation_streak,degradation_score=excluded.degradation_score,
    reverted=excluded.reverted,reversion_count=excluded.reversion_count,last_reason=excluded.last_reason,updated_at=now()
  `;
  await sql`
   insert into preventive_successor_validation_snapshots(
    model_version,status,validation_streak,degradation_score,reverted,
    baseline_calibration_error,baseline_brier_score,current_calibration_error,current_brier_score,rationale
   ) values(
    ${RELEASE.modelVersion},${status},${report.validationStreak},${report.degradationScore},${reverted},
    ${Number(handoff?.promotedCalibrationError||champion?.calibrationError||0)},
    ${Number(handoff?.promotedBrierScore||champion?.brierScore||0)},
    ${Number((calibration as any)?.calibrationError||0)},${Number((calibration as any)?.brierScore||0)},
    ${sql.json(report.rationale)}
   )
  `;
 }
 return {configured:Boolean(sql),...report,status,reverted,reversionCount};
}

export async function loadSuccessorValidationSummary(){
 const sql=db();if(!sql)return {status:'IDLE',validationStreak:0,degradationScore:0,reverted:false,reversionCount:0,rationale:[],recent:[]};
 try{
  const [state]=await sql`
   select status,validation_streak as "validationStreak",degradation_score::float as "degradationScore",
    reverted,reversion_count as "reversionCount",last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_successor_validation_state where singleton_key=1
  `;
  const recent=await sql`
   select id,status,validation_streak as "validationStreak",degradation_score::float as "degradationScore",
    reverted,generated_at as "generatedAt"
   from preventive_successor_validation_snapshots order by generated_at desc limit 20
  `;
  return {...state,rationale:state?.lastReason?[String(state.lastReason)]:[],recent};
 }catch{return {status:'IDLE',validationStreak:0,degradationScore:0,reverted:false,reversionCount:0,rationale:[],recent:[]}}
}
