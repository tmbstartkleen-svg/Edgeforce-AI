import {db} from './db';
import {RELEASE} from './releaseManifest';
import {attributeOperationalIncident,persistIncidentAttribution} from './incidentAttribution';
import {runIncidentPatternLearning} from './incidentPatternLearning';
import {runPredictiveIncidentRisk} from './predictiveIncidentRisk';
import {runPreventiveActionLearning} from './preventiveActionLearning';
import {buildProductionObservability,persistProductionObservability,type OpsHealthState} from './productionObservability';

export type DeploymentBudgetState='OPEN'|'FROZEN'|'RECOVERING';

export type SloHealthSample={
 observedAt:string;
 overallState:OpsHealthState|string;
 healthScore:number;
 criticalChecks:number;
 degradedChecks:number;
 unknownChecks:number;
 actionIncidents:number;
 watchIncidents:number;
};

export type SloWindow={
 label:string;
 windowMinutes:number;
 samples:number;
 sufficient:boolean;
 badFraction:number;
 availability:number;
 burnRate:number;
 budgetRemaining:number;
 criticalSamples:number;
 degradedSamples:number;
 actionSamples:number;
};

export type SloGovernorReport={
 target:number;
 allowedBadFraction:number;
 state:DeploymentBudgetState;
 deploymentAllowed:boolean;
 freezeTriggered:boolean;
 recoveryEligible:boolean;
 recoveryStreak:number;
 reasons:string[];
 warnings:string[];
 current:{overall:string;score:number;criticalChecks:number;actionIncidents:number};
 windows:{oneHour:SloWindow;twentyFourHour:SloWindow;sevenDay:SloWindow};
 generatedAt:string;
};

export type SloStateTransition={
 state:DeploymentBudgetState;
 recoveryStreak:number;
 transition:boolean;
 reason:string;
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const num=(v:unknown,fallback=0)=>{const n=Number(v);return Number.isFinite(n)?n:fallback};

function sampleBadWeight(sample:SloHealthSample){
 const state=String(sample.overallState||'UNKNOWN').toUpperCase();
 const stateWeight=state==='CRITICAL' ? 1 : state==='UNKNOWN' ? .25 : state==='DEGRADED' ? .05 : 0;
 const incidentWeight=sample.actionIncidents>0 ? 1 : sample.watchIncidents>0 ? .10 : 0;
 const checkWeight=sample.criticalChecks>0 ? .75 : sample.degradedChecks>0 ? .05 : 0;
 return Math.max(stateWeight,incidentWeight,checkWeight);
}

export function evaluateSloWindow(
 samples:SloHealthSample[],
 now:Date,
 windowMinutes:number,
 label:string,
 target=.99,
 minSamples=1
):SloWindow{
 const cutoff=now.getTime()-windowMinutes*60000;
 const selected=samples.filter(x=>new Date(x.observedAt).getTime()>=cutoff);
 const bad=selected.reduce((sum,x)=>sum+sampleBadWeight(x),0);
 const badFraction=selected.length?bad/selected.length:0;
 const availability=clamp(1-badFraction);
 const allowedBadFraction=Math.max(.0001,1-target);
 const burnRate=badFraction/allowedBadFraction;
 const budgetRemaining=1-burnRate;
 return {
  label,windowMinutes,samples:selected.length,sufficient:selected.length>=minSamples,
  badFraction,availability,burnRate,budgetRemaining,
  criticalSamples:selected.filter(x=>String(x.overallState).toUpperCase()==='CRITICAL').length,
  degradedSamples:selected.filter(x=>String(x.overallState).toUpperCase()==='DEGRADED').length,
  actionSamples:selected.filter(x=>x.actionIncidents>0).length
 };
}

export function evaluateSloGovernor(
 samples:SloHealthSample[],
 current:{overall:string;score:number;criticalChecks:number;actionIncidents:number},
 target=.99,
 now=new Date()
){
 const oneHour=evaluateSloWindow(samples,now,60,'1h',target,3);
 const twentyFourHour=evaluateSloWindow(samples,now,24*60,'24h',target,8);
 const sevenDay=evaluateSloWindow(samples,now,7*24*60,'7d',target,20);
 const reasons:string[]=[];
 const warnings:string[]=[];
 let freezeTriggered=false;

 if(current.overall==='CRITICAL'){
  freezeTriggered=true;
  reasons.push('current production observability is CRITICAL');
 }
 if(current.actionIncidents>0){
  freezeTriggered=true;
  reasons.push(`${current.actionIncidents} unresolved ACTION incident(s) are active`);
 }
 if(oneHour.sufficient&&oneHour.burnRate>=8){
  freezeTriggered=true;
  reasons.push(`1h SLO burn is ${oneHour.burnRate.toFixed(1)}x`);
 }
 if(twentyFourHour.sufficient&&twentyFourHour.burnRate>=4){
  freezeTriggered=true;
  reasons.push(`24h SLO burn is ${twentyFourHour.burnRate.toFixed(1)}x`);
 }
 if(sevenDay.sufficient&&sevenDay.budgetRemaining<=0){
  freezeTriggered=true;
  reasons.push('7d SLO error budget is exhausted');
 }

 if(oneHour.sufficient&&oneHour.burnRate>=4&&oneHour.burnRate<8)warnings.push(`1h burn is elevated at ${oneHour.burnRate.toFixed(1)}x`);
 if(twentyFourHour.sufficient&&twentyFourHour.burnRate>=2&&twentyFourHour.burnRate<4)warnings.push(`24h burn is elevated at ${twentyFourHour.burnRate.toFixed(1)}x`);
 if(sevenDay.sufficient&&sevenDay.budgetRemaining<.25&&sevenDay.budgetRemaining>0)warnings.push(`7d error budget has ${Math.max(0,sevenDay.budgetRemaining*100).toFixed(1)}% remaining`);
 if(!oneHour.sufficient||!twentyFourHour.sufficient||!sevenDay.sufficient)warnings.push('some SLO windows are still accumulating evidence');

 const recoveryEligible=
  !freezeTriggered&&
  oneHour.sufficient&&
  oneHour.burnRate<2&&
  current.overall!=='CRITICAL'&&
  current.actionIncidents===0;

 return {
  target,
  allowedBadFraction:1-target,
  freezeTriggered,
  recoveryEligible,
  reasons,
  warnings,
  windows:{oneHour,twentyFourHour,sevenDay}
 };
}

export function nextSloDeploymentState(
 previous:{state:DeploymentBudgetState;recoveryStreak:number}|undefined,
 freezeTriggered:boolean,
 recoveryEligible:boolean,
 reason:string
):SloStateTransition{
 const state=previous?.state??'OPEN';
 const streak=previous?.recoveryStreak??0;

 if(freezeTriggered){
  return {
   state:'FROZEN',
   recoveryStreak:0,
   transition:state!=='FROZEN',
   reason:reason||'error-budget freeze trigger is active'
  };
 }

 if(state==='FROZEN'){
  if(!recoveryEligible)return {state:'FROZEN',recoveryStreak:0,transition:false,reason:'freeze remains until recovery evidence is sufficient'};
  return {state:'RECOVERING',recoveryStreak:1,transition:true,reason:'first safe recovery check passed'};
 }

 if(state==='RECOVERING'){
  if(!recoveryEligible)return {state:'FROZEN',recoveryStreak:0,transition:true,reason:'recovery evidence regressed; deployment freeze restored'};
  if(streak>=2)return {state:'OPEN',recoveryStreak:streak+1,transition:true,reason:'three consecutive safe checks passed; deployment freeze cleared'};
  return {state:'RECOVERING',recoveryStreak:streak+1,transition:false,reason:`recovery check ${streak+1}/3 passed`};
 }

 return {state:'OPEN',recoveryStreak:0,transition:false,reason:'SLO budget is within deployment limits'};
}

async function loadHealthSamples():Promise<SloHealthSample[]>{
 const sql=db();if(!sql)return [];
 const rows=await sql`
  select observed_at as "observedAt",overall_state as "overallState",health_score::float as "healthScore",
   critical_checks as "criticalChecks",degraded_checks as "degradedChecks",unknown_checks as "unknownChecks",
   action_incidents as "actionIncidents",watch_incidents as "watchIncidents"
  from operational_health_snapshots
  where observed_at>=now()-interval '7 days'
  order by observed_at asc
 `;
 return (rows as any[]).map(row=>({
  observedAt:String(row.observedAt),
  overallState:String(row.overallState||'UNKNOWN'),
  healthScore:num(row.healthScore,.5),
  criticalChecks:num(row.criticalChecks),
  degradedChecks:num(row.degradedChecks),
  unknownChecks:num(row.unknownChecks),
  actionIncidents:num(row.actionIncidents),
  watchIncidents:num(row.watchIncidents)
 }));
}

async function loadPersistedState(){
 const sql=db();if(!sql)return null;
 try{
  const [row]=await sql`
   select deployment_state as state,recovery_streak as "recoveryStreak",slo_target::float as target,
    last_reason as "lastReason",frozen_at as "frozenAt",recovered_at as "recoveredAt",updated_at as "updatedAt"
   from slo_error_budget_state where singleton_key=1
  `;
  return row||null;
 }catch{return null}
}

export async function buildSloGovernorReport():Promise<SloGovernorReport>{
 const target=Math.min(.999,Math.max(.95,num(process.env.EDGEFORCE_SLO_TARGET,.99)));
 const [samples,currentObs,persisted]=await Promise.all([
  loadHealthSamples(),
  buildProductionObservability(),
  loadPersistedState()
 ]);
 const evaluation=evaluateSloGovernor(samples,{
  overall:String(currentObs.overall),
  score:num(currentObs.score),
  criticalChecks:num(currentObs.summary?.critical),
  actionIncidents:num(currentObs.incidents?.action)
 },target,new Date());
 const persistedState=(persisted?.state||'OPEN') as DeploymentBudgetState;
 const currentState:SloStateTransition['state']=evaluation.freezeTriggered?'FROZEN':persistedState;
 const recoveryStreak=num(persisted?.recoveryStreak);
 const deploymentAllowed=currentState==='OPEN'&&!evaluation.freezeTriggered;
 return {
  target,
  allowedBadFraction:evaluation.allowedBadFraction,
  state:currentState,
  deploymentAllowed,
  freezeTriggered:evaluation.freezeTriggered,
  recoveryEligible:evaluation.recoveryEligible,
  recoveryStreak,
  reasons:evaluation.reasons,
  warnings:evaluation.warnings,
  current:{
   overall:String(currentObs.overall),score:num(currentObs.score),
   criticalChecks:num(currentObs.summary?.critical),actionIncidents:num(currentObs.incidents?.action)
  },
  windows:evaluation.windows,
  generatedAt:new Date().toISOString()
 };
}

async function syncFreezeIncident(next:SloStateTransition){
 const sql=db();if(!sql)return;
 if(next.state==='FROZEN'){
  const existing=await sql`
   select id from runtime_incidents
   where resolved_at is null and event_type='SLO_ERROR_BUDGET_FROZEN'
   limit 1
  `;
  if(!(existing as any[]).length){
   await sql`
    insert into runtime_incidents(severity,event_type,message,metadata)
    values('INFO','SLO_ERROR_BUDGET_FROZEN',${next.reason},${sql.json({state:next.state,recoveryStreak:next.recoveryStreak})})
   `;
  }
 }else if(next.state==='OPEN'){
  await sql`
   update runtime_incidents set resolved_at=now(),
    metadata=coalesce(metadata,'{}'::jsonb)||${sql.json({autoRecovered:true,recoveredAt:new Date().toISOString()})}::jsonb
   where resolved_at is null and event_type='SLO_ERROR_BUDGET_FROZEN'
  `;
 }
}

export async function runSloGovernor(){
 const sql=db();
 const obs=await buildProductionObservability();
 await persistProductionObservability(obs).catch(()=>({persisted:false}));
 await persistIncidentAttribution({attribution:attributeOperationalIncident(obs),observability:obs}).catch(()=>({persisted:false}));
 await runIncidentPatternLearning().catch(()=>({persisted:false}));
 await runPredictiveIncidentRisk().catch(()=>({persisted:false}));
 await runPreventiveActionLearning().catch(()=>({persisted:false}));
 if(!sql){
  const report=await buildSloGovernorReport();
  return {configured:false,...report,transition:false};
 }

 const target=Math.min(.999,Math.max(.95,num(process.env.EDGEFORCE_SLO_TARGET,.99)));
 const samples=await loadHealthSamples();
 const evaluation=evaluateSloGovernor(samples,{
  overall:String(obs.overall),
  score:num(obs.score),
  criticalChecks:num(obs.summary?.critical),
  actionIncidents:num(obs.incidents?.action)
 },target,new Date());
 const persisted=await loadPersistedState();
 const previous=persisted?{state:String(persisted.state) as DeploymentBudgetState,recoveryStreak:num(persisted.recoveryStreak)}:undefined;
 const reason=evaluation.reasons.join('; ')||evaluation.warnings[0]||'SLO budget is within deployment limits';
 const next=nextSloDeploymentState(previous,evaluation.freezeTriggered,evaluation.recoveryEligible,reason);
 const now=new Date().toISOString();

 await sql`
  insert into slo_error_budget_state(
   singleton_key,deployment_state,recovery_streak,slo_target,last_reason,frozen_at,recovered_at,last_transition_at,updated_at,metadata
  ) values(
   1,${next.state},${next.recoveryStreak},${target},${next.reason},
   ${next.state==='FROZEN'?now:null},${next.state==='OPEN'&&next.transition?now:null},${next.transition?now:null},now(),
   ${sql.json({freezeTriggered:evaluation.freezeTriggered,recoveryEligible:evaluation.recoveryEligible,warnings:evaluation.warnings})}
  )
  on conflict(singleton_key) do update set
   deployment_state=excluded.deployment_state,recovery_streak=excluded.recovery_streak,slo_target=excluded.slo_target,
   last_reason=excluded.last_reason,
   frozen_at=case when excluded.deployment_state='FROZEN' then coalesce(slo_error_budget_state.frozen_at,excluded.frozen_at) else null end,
   recovered_at=coalesce(excluded.recovered_at,slo_error_budget_state.recovered_at),
   last_transition_at=coalesce(excluded.last_transition_at,slo_error_budget_state.last_transition_at),
   updated_at=now(),metadata=excluded.metadata
 `;

 await sql`
  insert into slo_error_budget_snapshots(
   model_version,deployment_state,slo_target,deployment_allowed,freeze_triggered,recovery_eligible,
   current_overall,current_score,one_hour,twenty_four_hour,seven_day,reasons,metadata
  ) values(
   ${RELEASE.modelVersion},${next.state},${target},${next.state==='OPEN'&&!evaluation.freezeTriggered},
   ${evaluation.freezeTriggered},${evaluation.recoveryEligible},${String(obs.overall)},${num(obs.score)},
   ${sql.json(evaluation.windows.oneHour as any)},${sql.json(evaluation.windows.twentyFourHour as any)},
   ${sql.json(evaluation.windows.sevenDay as any)},${sql.json(evaluation.reasons)},
   ${sql.json({warnings:evaluation.warnings,recoveryStreak:next.recoveryStreak})}
  )
 `;

 if(next.transition){
  await sql`
   insert into slo_error_budget_events(previous_state,next_state,reason,recovery_streak,metadata)
   values(${previous?.state||'OPEN'},${next.state},${next.reason},${next.recoveryStreak},${sql.json({target,windows:evaluation.windows})})
  `;
  await syncFreezeIncident(next);
 }

 return {
  configured:true,
  target,
  allowedBadFraction:1-target,
  state:next.state,
  deploymentAllowed:next.state==='OPEN'&&!evaluation.freezeTriggered,
  freezeTriggered:evaluation.freezeTriggered,
  recoveryEligible:evaluation.recoveryEligible,
  recoveryStreak:next.recoveryStreak,
  transition:next.transition,
  reasons:evaluation.reasons,
  warnings:evaluation.warnings,
  current:{overall:String(obs.overall),score:num(obs.score),criticalChecks:num(obs.summary?.critical),actionIncidents:num(obs.incidents?.action)},
  windows:evaluation.windows,
  generatedAt:new Date().toISOString()
 };
}

export async function loadSloGovernorSummary(){
 const sql=db();
 const current=await buildSloGovernorReport();
 if(!sql)return {...current,recent:[],events:[]};
 try{
  const [recent,events]=await Promise.all([
   sql`
    select id,model_version as "modelVersion",deployment_state as state,slo_target::float as target,
     deployment_allowed as "deploymentAllowed",freeze_triggered as "freezeTriggered",recovery_eligible as "recoveryEligible",
     current_overall as "currentOverall",current_score::float as "currentScore",one_hour as "oneHour",
     twenty_four_hour as "twentyFourHour",seven_day as "sevenDay",reasons,observed_at as "observedAt"
    from slo_error_budget_snapshots order by observed_at desc limit 30
   `,
   sql`
    select id,previous_state as "previousState",next_state as "nextState",reason,recovery_streak as "recoveryStreak",created_at as "createdAt"
    from slo_error_budget_events order by created_at desc limit 30
   `
  ]);
  return {...current,recent,events};
 }catch{return {...current,recent:[],events:[]}}
}
