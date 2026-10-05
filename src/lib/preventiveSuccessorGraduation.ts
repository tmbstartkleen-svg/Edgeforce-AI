import {db} from './db';
import {loadChampionBaselineSummary} from './preventiveChampionBaseline';
import {loadSuccessorValidationSummary} from './preventiveSuccessorValidation';
import {RELEASE} from './releaseManifest';

export function evaluateSuccessorGraduation(input:{
 championSource:string;
 validationStatus:string;
 validationStreak:number;
}){
 const rationale:string[]=[];
 if(input.championSource!=='SUCCESSION_CHAMPION'){
  return {status:'IDLE' as const,eligible:false,rationale:['No probationary succession champion is active.']};
 }
 const eligible=input.validationStatus==='CONFIRMED'&&input.validationStreak>=3;
 if(!eligible){
  rationale.push('Succession champion has not yet completed post-handoff confirmation.');
  return {status:'WAITING' as const,eligible:false,rationale};
 }
 rationale.push('Post-handoff confirmation completed; succession champion may graduate into normal champion lifecycle.');
 return {status:'GRADUATE' as const,eligible:true,rationale};
}

async function loadPersisted(){
 const sql=db();if(!sql)return null;
 try{
  const [row]=await sql`
   select graduation_count as "graduationCount"
   from preventive_successor_graduation_state where singleton_key=1
  `;
  return row||null;
 }catch{return null}
}

export async function runSuccessorGraduationGovernor(){
 const sql=db();
 const [champion,validation,previous]=await Promise.all([
  loadChampionBaselineSummary(),
  loadSuccessorValidationSummary(),
  loadPersisted()
 ]);
 const decision=evaluateSuccessorGraduation({
  championSource:String(champion?.source||''),
  validationStatus:String(validation?.status||'IDLE'),
  validationStreak:Number(validation?.validationStreak||0)
 });
 let graduated=false;
 if(sql&&decision.eligible){
  await sql`
   update preventive_champion_baseline_state
   set source='CONFIRMED_SUCCESSION_CHAMPION',
    rationale=${sql.json(decision.rationale)},updated_at=now()
   where singleton_key=1 and source='SUCCESSION_CHAMPION'
  `;
  await sql`
   update preventive_baseline_handoff_state
   set status='CONFIRMED',promoted=true,last_reason='V92 succession champion graduated after post-handoff validation.',updated_at=now()
   where singleton_key=1
  `;
  await sql`
   update preventive_successor_validation_state
   set status='GRADUATED',last_reason='V92 validation complete; successor moved into normal champion lifecycle.',updated_at=now()
   where singleton_key=1
  `;
  await sql`
   update preventive_champion_baseline_health_state
   set status='ACTIVE',retired=false,last_reason='V92 confirmed succession champion entered normal health supervision.',updated_at=now()
   where singleton_key=1
  `;
  graduated=true;
 }
 const graduationCount=Number(previous?.graduationCount||0)+(graduated?1:0);
 const status=graduated?'GRADUATED':decision.status;
 if(sql){
  await sql`
   insert into preventive_successor_graduation_state(
    singleton_key,status,graduated,graduation_count,validation_streak,source,last_reason,updated_at
   ) values(
    1,${status},${graduated},${graduationCount},${Number(validation?.validationStreak||0)},
    ${String(champion?.source||'')},${decision.rationale.join(' ')},now()
   )
   on conflict(singleton_key) do update set
    status=excluded.status,graduated=excluded.graduated,graduation_count=excluded.graduation_count,
    validation_streak=excluded.validation_streak,source=excluded.source,last_reason=excluded.last_reason,updated_at=now()
  `;
  await sql`
   insert into preventive_successor_graduation_snapshots(
    model_version,status,graduated,validation_streak,champion_source,rationale
   ) values(
    ${RELEASE.modelVersion},${status},${graduated},${Number(validation?.validationStreak||0)},
    ${String(champion?.source||'')},${sql.json(decision.rationale)}
   )
  `;
 }
 return {configured:Boolean(sql),...decision,status,graduated,graduationCount};
}

export async function loadSuccessorGraduationSummary(){
 const sql=db();if(!sql)return {status:'IDLE',graduated:false,graduationCount:0,validationStreak:0,source:null,rationale:[],recent:[]};
 try{
  const [state]=await sql`
   select status,graduated,graduation_count as "graduationCount",validation_streak as "validationStreak",
    source,last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_successor_graduation_state where singleton_key=1
  `;
  const recent=await sql`
   select id,status,graduated,validation_streak as "validationStreak",champion_source as "championSource",
    generated_at as "generatedAt"
   from preventive_successor_graduation_snapshots order by generated_at desc limit 20
  `;
  return {...state,rationale:state?.lastReason?[String(state.lastReason)]:[],recent};
 }catch{return {status:'IDLE',graduated:false,graduationCount:0,validationStreak:0,source:null,rationale:[],recent:[]}}
}
