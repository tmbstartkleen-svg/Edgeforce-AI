import {db} from './db';
import {RELEASE} from './releaseManifest';

export type BaselineLifecycleState={
 championSource:string;
 championActive:boolean;
 healthStatus:string;
 healthRetired:boolean;
 successionStatus:string;
 handoffStatus:string;
 handoffPromoted:boolean;
 validationStatus:string;
 validationReverted:boolean;
 graduationStatus:string;
 graduationGraduated:boolean;
};

export type LifecycleIssue={code:string;severity:'WATCH'|'REPAIR';message:string};

export function evaluateBaselineLifecycleConsistency(s:BaselineLifecycleState){
 const issues:LifecycleIssue[]=[];
 const confirmed=s.championSource==='CONFIRMED_SUCCESSION_CHAMPION';
 const probationary=s.championSource==='SUCCESSION_CHAMPION';
 const fullProbation=s.championSource==='FULL_PROBATION_CHAMPION';
 const retiredSource=s.championSource.includes('RETIRED')||s.championSource.includes('REVERTED');

 if(s.championActive&&retiredSource)issues.push({code:'ACTIVE_RETIRED_SOURCE',severity:'REPAIR',message:'Champion has an active timestamp but a retired/reverted source.'});
 if(s.championActive&&s.healthRetired)issues.push({code:'ACTIVE_HEALTH_RETIRED',severity:'REPAIR',message:'Active champion is marked retired in health state.'});
 if(!s.championActive&&s.healthStatus==='ACTIVE')issues.push({code:'NO_CHAMPION_HEALTH_ACTIVE',severity:'REPAIR',message:'Champion health is ACTIVE without an active champion.'});
 if(s.championActive&&s.successionStatus!=='IDLE')issues.push({code:'ACTIVE_CHAMPION_SUCCESSION_OPEN',severity:'REPAIR',message:'Succession remains open while a champion is active.'});

 if(confirmed){
  if(s.handoffStatus!=='CONFIRMED'||!s.handoffPromoted)issues.push({code:'CONFIRMED_HANDOFF_MISMATCH',severity:'REPAIR',message:'Confirmed successor is missing confirmed handoff state.'});
  if(s.validationStatus!=='GRADUATED'||s.validationReverted)issues.push({code:'CONFIRMED_VALIDATION_MISMATCH',severity:'REPAIR',message:'Confirmed successor is missing graduated validation state.'});
  if(s.graduationStatus!=='GRADUATED'||!s.graduationGraduated)issues.push({code:'CONFIRMED_GRADUATION_MISMATCH',severity:'REPAIR',message:'Confirmed successor is missing graduation state.'});
 }
 if(probationary){
  if(!s.handoffPromoted)issues.push({code:'SUCCESSOR_HANDOFF_NOT_PROMOTED',severity:'REPAIR',message:'Probationary succession champion is missing promoted handoff state.'});
  if(!['VALIDATING','CONFIRMED'].includes(s.validationStatus))issues.push({code:'SUCCESSOR_VALIDATION_INACTIVE',severity:'WATCH',message:'Probationary succession champion is not in active validation.'});
 }
 if(fullProbation){
  if(s.handoffPromoted||['VALIDATING','CONFIRMED'].includes(s.validationStatus)||s.graduationGraduated){
   issues.push({code:'FULL_PROBATION_STALE_SUCCESSION_STATE',severity:'REPAIR',message:'Full-probation champion retains stale succession lifecycle state.'});
  }
 }
 if(!s.championActive&&retiredSource&&s.successionStatus==='IDLE'){
  issues.push({code:'RETIRED_WITHOUT_SUCCESSION',severity:'REPAIR',message:'Retired/reverted champion has no active replacement succession cycle.'});
 }

 const repairable=issues.filter(x=>x.severity==='REPAIR').map(x=>x.code);
 const score=Math.max(0,1-issues.length*.12);
 return {
  status:repairable.length?'REPAIR_REQUIRED':issues.length?'WATCH':'HEALTHY',
  issueCount:issues.length,
  consistencyScore:score,
  issues,
  repairCodes:repairable
 };
}

async function loadLifecycleState():Promise<BaselineLifecycleState>{
 const sql=db();
 if(!sql)return {
  championSource:'',championActive:false,healthStatus:'NO_CHAMPION',healthRetired:false,
  successionStatus:'IDLE',handoffStatus:'IDLE',handoffPromoted:false,
  validationStatus:'IDLE',validationReverted:false,graduationStatus:'IDLE',graduationGraduated:false
 };
 const [champion]=await sql`select source,promoted_at as "promotedAt" from preventive_champion_baseline_state where singleton_key=1`;
 const [health]=await sql`select status,retired from preventive_champion_baseline_health_state where singleton_key=1`;
 const [succession]=await sql`select status from preventive_baseline_succession_state where singleton_key=1`;
 const [handoff]=await sql`select status,promoted from preventive_baseline_handoff_state where singleton_key=1`;
 const [validation]=await sql`select status,reverted from preventive_successor_validation_state where singleton_key=1`;
 const [graduation]=await sql`select status,graduated from preventive_successor_graduation_state where singleton_key=1`;
 return {
  championSource:String(champion?.source||''),
  championActive:Boolean(champion?.promotedAt),
  healthStatus:String(health?.status||'NO_CHAMPION'),
  healthRetired:Boolean(health?.retired),
  successionStatus:String(succession?.status||'IDLE'),
  handoffStatus:String(handoff?.status||'IDLE'),
  handoffPromoted:Boolean(handoff?.promoted),
  validationStatus:String(validation?.status||'IDLE'),
  validationReverted:Boolean(validation?.reverted),
  graduationStatus:String(graduation?.status||'IDLE'),
  graduationGraduated:Boolean(graduation?.graduated)
 };
}

async function applySafeRepairs(state:BaselineLifecycleState,codes:string[]){
 const sql=db();if(!sql||!codes.length)return 0;
 let repaired=0;
 const has=(code:string)=>codes.includes(code);

 if(has('ACTIVE_RETIRED_SOURCE')){
  await sql`update preventive_champion_baseline_state set promoted_at=null,updated_at=now() where singleton_key=1`;
  await sql`update preventive_champion_baseline_health_state set status='RETIRE',retired=true,last_reason='V93 reconciled retired champion source.',updated_at=now() where singleton_key=1`;
  repaired+=2;
 }
 if(has('ACTIVE_HEALTH_RETIRED')&&!has('ACTIVE_RETIRED_SOURCE')){
  await sql`update preventive_champion_baseline_health_state set status='ACTIVE',retired=false,last_reason='V93 reconciled active champion health.',updated_at=now() where singleton_key=1`;
  repaired++;
 }
 if(has('NO_CHAMPION_HEALTH_ACTIVE')){
  await sql`update preventive_champion_baseline_health_state set status='NO_CHAMPION',retired=false,last_reason='V93 reconciled health state without an active champion.',updated_at=now() where singleton_key=1`;
  repaired++;
 }
 if(has('ACTIVE_CHAMPION_SUCCESSION_OPEN')){
  await sql`update preventive_baseline_succession_state set status='IDLE',last_reason='V93 closed stale succession because an active champion exists.',updated_at=now() where singleton_key=1`;
  repaired++;
 }
 if(state.championSource==='CONFIRMED_SUCCESSION_CHAMPION'){
  if(has('CONFIRMED_HANDOFF_MISMATCH')){
   await sql`update preventive_baseline_handoff_state set status='CONFIRMED',promoted=true,last_reason='V93 reconciled confirmed successor handoff.',updated_at=now() where singleton_key=1`;
   repaired++;
  }
  if(has('CONFIRMED_VALIDATION_MISMATCH')){
   await sql`update preventive_successor_validation_state set status='GRADUATED',reverted=false,last_reason='V93 reconciled confirmed successor validation.',updated_at=now() where singleton_key=1`;
   repaired++;
  }
  if(has('CONFIRMED_GRADUATION_MISMATCH')){
   await sql`update preventive_successor_graduation_state set status='GRADUATED',graduated=true,last_reason='V93 reconciled confirmed successor graduation.',updated_at=now() where singleton_key=1`;
   repaired++;
  }
 }
 if(state.championSource==='SUCCESSION_CHAMPION'&&has('SUCCESSOR_HANDOFF_NOT_PROMOTED')){
  await sql`update preventive_baseline_handoff_state set status='PROMOTED',promoted=true,last_reason='V93 reconciled succession champion handoff.',updated_at=now() where singleton_key=1`;
  repaired++;
 }
 if(state.championSource==='FULL_PROBATION_CHAMPION'&&has('FULL_PROBATION_STALE_SUCCESSION_STATE')){
  await sql`update preventive_baseline_handoff_state set status='IDLE',promoted=false,last_reason='V93 cleared stale succession handoff.',updated_at=now() where singleton_key=1`;
  await sql`update preventive_successor_validation_state set status='IDLE',validation_streak=0,reverted=false,last_reason='V93 cleared stale successor validation.',updated_at=now() where singleton_key=1`;
  await sql`update preventive_successor_graduation_state set status='IDLE',graduated=false,validation_streak=0,last_reason='V93 cleared stale successor graduation.',updated_at=now() where singleton_key=1`;
  repaired+=3;
 }
 if(!state.championActive&&(state.championSource.includes('RETIRED')||state.championSource.includes('REVERTED'))&&has('RETIRED_WITHOUT_SUCCESSION')){
  await sql`update preventive_baseline_succession_state set status='BUILDING',last_reason='V93 reopened replacement succession after retirement/reversion.',updated_at=now() where singleton_key=1`;
  repaired++;
 }
 return repaired;
}

export async function runBaselineConsistencyGovernor(){
 const sql=db();
 const before=await loadLifecycleState();
 const evaluation=evaluateBaselineLifecycleConsistency(before);
 const repairedCount=await applySafeRepairs(before,evaluation.repairCodes);
 const after=repairedCount?await loadLifecycleState():before;
 const finalEvaluation=repairedCount?evaluateBaselineLifecycleConsistency(after):evaluation;
 if(!sql)return {configured:false,repairedCount,...finalEvaluation,lifecycle:after};

 await sql`
  insert into preventive_baseline_consistency_state(
   singleton_key,status,issue_count,repaired_count,consistency_score,last_repair_codes,last_reason,updated_at
  ) values(
   1,${finalEvaluation.status},${finalEvaluation.issueCount},${repairedCount},${finalEvaluation.consistencyScore},
   ${sql.json(evaluation.repairCodes)},${finalEvaluation.issues.map(x=>x.message).join(' ')},now()
  )
  on conflict(singleton_key) do update set
   status=excluded.status,issue_count=excluded.issue_count,repaired_count=excluded.repaired_count,
   consistency_score=excluded.consistency_score,last_repair_codes=excluded.last_repair_codes,
   last_reason=excluded.last_reason,updated_at=now()
 `;
 await sql`
  insert into preventive_baseline_consistency_snapshots(
   model_version,status,issue_count,repaired_count,consistency_score,issues,repair_codes,lifecycle
  ) values(
   ${RELEASE.modelVersion},${finalEvaluation.status},${finalEvaluation.issueCount},${repairedCount},
   ${finalEvaluation.consistencyScore},${sql.json(finalEvaluation.issues)},${sql.json(evaluation.repairCodes)},${sql.json(after)}
  )
 `;
 return {configured:true,repairedCount,...finalEvaluation,lifecycle:after};
}

export async function loadBaselineConsistencySummary(){
 const sql=db();if(!sql)return {status:'HEALTHY',issueCount:0,repairedCount:0,consistencyScore:1,repairCodes:[],rationale:[],recent:[]};
 try{
  const [state]=await sql`
   select status,issue_count as "issueCount",repaired_count as "repairedCount",
    consistency_score::float as "consistencyScore",last_repair_codes as "repairCodes",
    last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_baseline_consistency_state where singleton_key=1
  `;
  const recent=await sql`
   select id,status,issue_count as "issueCount",repaired_count as "repairedCount",
    consistency_score::float as "consistencyScore",generated_at as "generatedAt"
   from preventive_baseline_consistency_snapshots order by generated_at desc limit 20
  `;
  return {...state,rationale:state?.lastReason?[String(state.lastReason)]:[],recent};
 }catch{return {status:'HEALTHY',issueCount:0,repairedCount:0,consistencyScore:1,repairCodes:[],rationale:[],recent:[]}}
}
