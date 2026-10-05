import {db} from './db';
import {RELEASE} from './releaseManifest';

export type PreventiveActionEvent={
 id:number;
 cause:string;
 actionKey:string;
 actionText:string;
 sourceRiskScore:number;
 sourceRiskLevel:string;
 appliedAt:string;
 evaluatedAt:string|null;
 incidentOccurred:boolean|null;
 outcome:string|null;
};

export type ActionEffectivenessProfile={
 cause:string;
 actionKey:string;
 actionText:string;
 sampleSize:number;
 preventedCount:number;
 incidentCount:number;
 effectivenessScore:number;
 confidence:number;
};

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function normalizeActionKey(text:string){
 return text.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120)||'unspecified-action';
}

export function buildActionEffectivenessProfiles(events:PreventiveActionEvent[]):ActionEffectivenessProfile[]{
 const grouped=new Map<string,PreventiveActionEvent[]>();
 for(const e of events){
  if(e.incidentOccurred===null)continue;
  const key=`${e.cause}::${e.actionKey}`;
  const list=grouped.get(key)||[];
  list.push(e);grouped.set(key,list);
 }
 const out:ActionEffectivenessProfile[]=[];
 for(const [key,list] of grouped){
  const [cause,actionKey]=key.split('::');
  const preventedCount=list.filter(x=>x.incidentOccurred===false).length;
  const incidentCount=list.filter(x=>x.incidentOccurred===true).length;
  const sampleSize=list.length;
  const raw=preventedCount/Math.max(1,sampleSize);
  const confidence=clamp(sampleSize/8);
  const effectivenessScore=clamp(.5+(raw-.5)*confidence);
  out.push({
   cause,actionKey,actionText:list.at(-1)?.actionText||actionKey,
   sampleSize,preventedCount,incidentCount,effectivenessScore,confidence
  });
 }
 return out.sort((a,b)=>b.effectivenessScore-a.effectivenessScore||b.sampleSize-a.sampleSize);
}

async function loadPendingEvents(){
 const sql=db();if(!sql)return [] as PreventiveActionEvent[];
 const rows=await sql`
  select id,cause,action_key as "actionKey",action_text as "actionText",source_risk_score::float as "sourceRiskScore",
   source_risk_level as "sourceRiskLevel",applied_at as "appliedAt",evaluated_at as "evaluatedAt",
   incident_occurred as "incidentOccurred",outcome
  from preventive_action_events
  where evaluated_at is null and applied_at<=now()-interval '24 hours'
  order by applied_at asc
 `;
 return (rows as any[]).map(row=>({
  id:Number(row.id),cause:String(row.cause),actionKey:String(row.actionKey),actionText:String(row.actionText),
  sourceRiskScore:Number(row.sourceRiskScore||0),sourceRiskLevel:String(row.sourceRiskLevel||'LOW'),
  appliedAt:new Date(row.appliedAt).toISOString(),evaluatedAt:row.evaluatedAt?new Date(row.evaluatedAt).toISOString():null,
  incidentOccurred:row.incidentOccurred===null?null:Boolean(row.incidentOccurred),outcome:row.outcome?String(row.outcome):null
 }));
}

async function loadEvaluatedEvents(){
 const sql=db();if(!sql)return [] as PreventiveActionEvent[];
 const rows=await sql`
  select id,cause,action_key as "actionKey",action_text as "actionText",source_risk_score::float as "sourceRiskScore",
   source_risk_level as "sourceRiskLevel",applied_at as "appliedAt",evaluated_at as "evaluatedAt",
   incident_occurred as "incidentOccurred",outcome
  from preventive_action_events
  where evaluated_at is not null and applied_at>=now()-interval '90 days'
  order by applied_at asc
 `;
 return (rows as any[]).map(row=>({
  id:Number(row.id),cause:String(row.cause),actionKey:String(row.actionKey),actionText:String(row.actionText),
  sourceRiskScore:Number(row.sourceRiskScore||0),sourceRiskLevel:String(row.sourceRiskLevel||'LOW'),
  appliedAt:new Date(row.appliedAt).toISOString(),evaluatedAt:row.evaluatedAt?new Date(row.evaluatedAt).toISOString():null,
  incidentOccurred:row.incidentOccurred===null?null:Boolean(row.incidentOccurred),outcome:row.outcome?String(row.outcome):null
 }));
}

export async function evaluatePendingPreventiveActions(){
 const sql=db();if(!sql)return {evaluated:0};
 const pending=await loadPendingEvents();
 let evaluated=0;
 for(const e of pending){
  const rows=await sql`
   select 1
   from incident_attribution_snapshots
   where primary_cause=${e.cause}
    and severity='ACTION'
    and observed_at>${e.appliedAt}
    and observed_at<=${e.appliedAt}::timestamptz+interval '24 hours'
   limit 1
  `;
  const incidentOccurred=(rows as any[]).length>0;
  await sql`
   update preventive_action_events
   set evaluated_at=now(),incident_occurred=${incidentOccurred},
    outcome=${incidentOccurred?'INCIDENT_OCCURRED':'PREVENTED_OR_NO_INCIDENT'}
   where id=${e.id}
  `;
  evaluated++;
 }
 return {evaluated};
}

export async function rebuildPreventiveActionEffectiveness(){
 const sql=db();if(!sql)return {profiles:[] as ActionEffectivenessProfile[],persisted:false};
 const events=await loadEvaluatedEvents();
 const profiles=buildActionEffectivenessProfiles(events);
 for(const p of profiles){
  await sql`
   insert into preventive_action_effectiveness(
    cause,action_key,sample_size,prevented_count,incident_count,effectiveness_score,confidence,updated_at
   ) values(
    ${p.cause},${p.actionKey},${p.sampleSize},${p.preventedCount},${p.incidentCount},${p.effectivenessScore},${p.confidence},now()
   )
   on conflict(cause,action_key) do update set
    sample_size=excluded.sample_size,prevented_count=excluded.prevented_count,incident_count=excluded.incident_count,
    effectiveness_score=excluded.effectiveness_score,confidence=excluded.confidence,updated_at=now()
  `;
 }
 const best=profiles[0]||null;
 await sql`
  insert into preventive_action_learning_snapshots(
   model_version,evaluated_events,best_cause,best_action_key,best_effectiveness,profiles
  ) values(
   ${RELEASE.modelVersion},${events.length},${best?.cause||null},${best?.actionKey||null},
   ${best?.effectivenessScore||0},${sql.json(profiles as any)}
  )
 `;
 return {profiles,persisted:true,evaluatedEvents:events.length};
}

export async function recordPreventiveAction(input:{cause:string;actionText:string;sourceRiskScore:number;sourceRiskLevel:string;appliedBy?:string|null}){
 const sql=db();if(!sql)return {recorded:false,id:null};
 const actionKey=normalizeActionKey(input.actionText);
 const rows=await sql`
  insert into preventive_action_events(cause,action_key,action_text,source_risk_score,source_risk_level,applied_by)
  values(${input.cause},${actionKey},${input.actionText},${input.sourceRiskScore},${input.sourceRiskLevel},${input.appliedBy||null})
  returning id
 `;
 return {recorded:true,id:Number((rows as any[])[0]?.id||0),actionKey};
}

export async function runPreventiveActionLearning(){
 const evaluation=await evaluatePendingPreventiveActions();
 const rebuilt=await rebuildPreventiveActionEffectiveness();
 return {...rebuilt,evaluatedNow:evaluation.evaluated};
}

export async function loadPreventiveActionLearningSummary(){
 const sql=db();
 if(!sql)return {generatedAt:new Date().toISOString(),profiles:[],evaluatedEvents:0,recent:[]};
 try{
  const [profiles,recent]=await Promise.all([
   sql`
    select cause,action_key as "actionKey",sample_size as "sampleSize",prevented_count as "preventedCount",
     incident_count as "incidentCount",effectiveness_score::float as "effectivenessScore",confidence::float as confidence,
     updated_at as "updatedAt"
    from preventive_action_effectiveness
    order by effectiveness_score desc,sample_size desc
    limit 50
   `,
   sql`
    select id,cause,action_key as "actionKey",action_text as "actionText",source_risk_score::float as "sourceRiskScore",
     source_risk_level as "sourceRiskLevel",applied_at as "appliedAt",evaluated_at as "evaluatedAt",
     incident_occurred as "incidentOccurred",outcome
    from preventive_action_events order by applied_at desc limit 30
   `
  ]);
  return {generatedAt:new Date().toISOString(),profiles,recent,evaluatedEvents:(profiles as any[]).reduce((s,x)=>s+Number(x.sampleSize||0),0)};
 }catch{return {generatedAt:new Date().toISOString(),profiles:[],evaluatedEvents:0,recent:[]}}
}
