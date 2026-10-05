import {db} from './db';
import type {Market,ContextProvenance} from './types';
import {buildUnifiedIntelligenceCertification,type UnifiedIntelligenceCertification,type IntelligenceComponent} from './unifiedIntelligence';
import {RELEASE} from './releaseManifest';

export type CircuitState='CLOSED'|'HALF_OPEN'|'OPEN';
export type ReliabilityMode='NORMAL'|'DEGRADED'|'PROTECTIVE';

export type ReliabilityStateRow={
 componentId:string;label:string;required:boolean;circuitState:CircuitState;observedState:string;
 consecutiveFailures:number;consecutiveHealthy:number;reliabilityScore:number;lastReason:string|null;
 openedAt:string|null;recoveredAt:string|null;lastTransitionAt:string|null;updatedAt:string;
};

export type ReliabilitySnapshot={
 mode:ReliabilityMode;
 score:number;
 criticalOpen:boolean;
 openComponents:string[];
 halfOpenComponents:string[];
 rows:ReliabilityStateRow[];
 generatedAt:string;
};

type PreviousState={
 circuitState:CircuitState;
 consecutiveFailures:number;
 consecutiveHealthy:number;
};

export type CircuitTransition={
 circuitState:CircuitState;
 consecutiveFailures:number;
 consecutiveHealthy:number;
 transition:boolean;
 reason:string;
};

const hardFailure=(state:string)=>state==='FAILED'||state==='STALE';
const softFailure=(state:string)=>state==='DEGRADED'||state==='UNAVAILABLE';
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

function observedScore(state:string){
 if(state==='HEALTHY')return 1;
 if(state==='DEGRADED')return .72;
 if(state==='WARMING')return .58;
 if(state==='UNAVAILABLE')return .35;
 if(state==='STALE')return .18;
 return 0;
}

export function nextCircuitTransition(previous:PreviousState|undefined,component:Pick<IntelligenceComponent,'state'|'required'|'label'>):CircuitTransition{
 const current=previous?.circuitState??'CLOSED';
 const prevFailures=previous?.consecutiveFailures??0;
 const prevHealthy=previous?.consecutiveHealthy??0;
 const healthy=component.state==='HEALTHY';
 const hard=hardFailure(component.state);
 const soft=softFailure(component.state);

 if(current==='OPEN'){
  if(healthy){
   return {
    circuitState:'HALF_OPEN',consecutiveFailures:0,consecutiveHealthy:1,transition:true,
    reason:`${component.label} produced one healthy recovery check; entering half-open confirmation`
   };
  }
  return {
   circuitState:'OPEN',consecutiveFailures:prevFailures+1,consecutiveHealthy:0,transition:false,
   reason:`${component.label} remains ${component.state.toLowerCase()}; circuit stays open`
  };
 }

 if(current==='HALF_OPEN'){
  if(healthy&&prevHealthy>=1){
   return {
    circuitState:'CLOSED',consecutiveFailures:0,consecutiveHealthy:prevHealthy+1,transition:true,
    reason:`${component.label} passed two consecutive recovery checks; circuit closed`
   };
  }
  if(healthy){
   return {
    circuitState:'HALF_OPEN',consecutiveFailures:0,consecutiveHealthy:prevHealthy+1,transition:false,
    reason:`${component.label} recovery confirmation is still in progress`
   };
  }
  if(hard){
   return {
    circuitState:'OPEN',consecutiveFailures:prevFailures+1,consecutiveHealthy:0,transition:true,
    reason:`${component.label} relapsed to ${component.state.toLowerCase()} during half-open recovery`
   };
  }
  return {
   circuitState:'HALF_OPEN',consecutiveFailures:soft?prevFailures+1:prevFailures,consecutiveHealthy:0,transition:false,
   reason:`${component.label} is not healthy enough to close the circuit`
  };
 }

 if(healthy){
  return {
   circuitState:'CLOSED',consecutiveFailures:0,consecutiveHealthy:prevHealthy+1,transition:false,
   reason:`${component.label} is healthy`
  };
 }

 const failureCount=prevFailures+1;
 const threshold=component.required?2:3;
 if(hard&&failureCount>=threshold){
  return {
   circuitState:'OPEN',consecutiveFailures:failureCount,consecutiveHealthy:0,transition:true,
   reason:`${component.label} hit ${failureCount} consecutive hard failures and opened its circuit`
  };
 }

 return {
  circuitState:'CLOSED',consecutiveFailures:failureCount,consecutiveHealthy:0,transition:false,
  reason:hard
   ?`${component.label} hard failure ${failureCount}/${threshold}; confirmation required before isolation`
   :soft
    ?`${component.label} is degraded but below the circuit-open threshold`
    :`${component.label} is warming and remains available`
 };
}

function modeFromRows(rows:ReliabilityStateRow[],certification?:UnifiedIntelligenceCertification):ReliabilityMode{
 const requiredOpen=rows.some(x=>x.required&&x.circuitState==='OPEN');
 const criticalIdOpen=rows.some(x=>['injuries','automation','validation'].includes(x.componentId)&&x.circuitState==='OPEN');
 if(requiredOpen||criticalIdOpen||certification?.state==='BLOCKED')return 'PROTECTIVE';
 if(rows.some(x=>x.circuitState!=='CLOSED')||certification?.state==='DEGRADED')return 'DEGRADED';
 return 'NORMAL';
}

function snapshotScore(rows:ReliabilityStateRow[]){
 if(!rows.length)return .65;
 return clamp(rows.reduce((sum,row)=>{
  const circuit=row.circuitState==='CLOSED' ? 1 : row.circuitState==='HALF_OPEN' ? .65 : .20;
  return sum+row.reliabilityScore*circuit;
 },0)/rows.length);
}

export async function loadIntelligenceReliabilityState():Promise<ReliabilitySnapshot>{
 const sql=db();
 if(!sql)return {mode:'DEGRADED',score:.60,criticalOpen:false,openComponents:[],halfOpenComponents:[],rows:[],generatedAt:new Date().toISOString()};
 try{
  const rows=await sql`
   select component_id as "componentId",label,required,circuit_state as "circuitState",observed_state as "observedState",
    consecutive_failures as "consecutiveFailures",consecutive_healthy as "consecutiveHealthy",
    reliability_score::float as "reliabilityScore",last_reason as "lastReason",opened_at as "openedAt",
    recovered_at as "recoveredAt",last_transition_at as "lastTransitionAt",updated_at as "updatedAt"
   from intelligence_reliability_state
   order by required desc,component_id
  `;
  const typed=rows as unknown as ReliabilityStateRow[];
  const openComponents=typed.filter(x=>x.circuitState==='OPEN').map(x=>x.componentId);
  const halfOpenComponents=typed.filter(x=>x.circuitState==='HALF_OPEN').map(x=>x.componentId);
  return {
   mode:modeFromRows(typed),score:snapshotScore(typed),
   criticalOpen:typed.some(x=>x.required&&x.circuitState==='OPEN'),
   openComponents,halfOpenComponents,rows:typed,generatedAt:new Date().toISOString()
  };
 }catch{
  return {mode:'DEGRADED',score:.55,criticalOpen:false,openComponents:[],halfOpenComponents:[],rows:[],generatedAt:new Date().toISOString()};
 }
}

async function persistIncident(component:IntelligenceComponent,transition:CircuitTransition){
 const sql=db();if(!sql)return;
 if(transition.circuitState==='OPEN'){
  const existing=await sql`
   select id from runtime_incidents
   where resolved_at is null and event_type='INTELLIGENCE_CIRCUIT_OPEN'
    and metadata->>'componentId'=${component.id}
   limit 1
  `;
  if(!(existing as any[]).length){
   await sql`
    insert into runtime_incidents(severity,event_type,message,metadata)
    values(
     ${component.required?'ACTION':'WATCH'},'INTELLIGENCE_CIRCUIT_OPEN',
     ${transition.reason},${sql.json({componentId:component.id,label:component.label,required:component.required,observedState:component.state})}
    )
   `;
  }
 }else if(transition.circuitState==='CLOSED'){
  await sql`
   update runtime_incidents set resolved_at=now(),
    metadata=coalesce(metadata,'{}'::jsonb)||${sql.json({autoRecovered:true,recoveredAt:new Date().toISOString()})}::jsonb
   where resolved_at is null and event_type='INTELLIGENCE_CIRCUIT_OPEN'
    and metadata->>'componentId'=${component.id}
  `;
 }
}

export async function runIntelligenceReliabilitySupervisor(input?:UnifiedIntelligenceCertification){
 const sql=db();
 const certification=input??await buildUnifiedIntelligenceCertification();
 if(!sql){
  return {configured:false,mode:certification.state==='BLOCKED'?'PROTECTIVE':'DEGRADED',score:.55,opened:0,recovered:0,rows:[] as ReliabilityStateRow[]};
 }
 const previousRows=await sql`
  select component_id as "componentId",circuit_state as "circuitState",
   consecutive_failures as "consecutiveFailures",consecutive_healthy as "consecutiveHealthy"
  from intelligence_reliability_state
 `;
 const previous=new Map<string,PreviousState>();
 for(const row of previousRows as any[])previous.set(String(row.componentId),{
  circuitState:String(row.circuitState) as CircuitState,
  consecutiveFailures:Number(row.consecutiveFailures||0),
  consecutiveHealthy:Number(row.consecutiveHealthy||0)
 });

 let opened=0,recovered=0;
 const now=new Date().toISOString();
 for(const component of certification.components){
  const prior=previous.get(component.id);
  const transition=nextCircuitTransition(prior,component);
  if(transition.transition&&transition.circuitState==='OPEN')opened++;
  if(transition.transition&&transition.circuitState==='CLOSED')recovered++;
  const score=observedScore(component.state);
  const openedAt=transition.circuitState==='OPEN'
   ?(prior?.circuitState==='OPEN'?null:now)
   :null;
  const recoveredAt=transition.transition&&transition.circuitState==='CLOSED'?now:null;
  await sql`
   insert into intelligence_reliability_state(
    component_id,label,required,circuit_state,observed_state,consecutive_failures,consecutive_healthy,
    reliability_score,last_reason,opened_at,recovered_at,last_transition_at,updated_at,metadata
   ) values(
    ${component.id},${component.label},${component.required},${transition.circuitState},${component.state},
    ${transition.consecutiveFailures},${transition.consecutiveHealthy},${score},${transition.reason},
    ${openedAt},${recoveredAt},${transition.transition?now:null},now(),${sql.json({rows:component.rows,ageMinutes:component.ageMinutes,detail:component.detail})}
   )
   on conflict(component_id) do update set
    label=excluded.label,required=excluded.required,circuit_state=excluded.circuit_state,observed_state=excluded.observed_state,
    consecutive_failures=excluded.consecutive_failures,consecutive_healthy=excluded.consecutive_healthy,
    reliability_score=excluded.reliability_score,last_reason=excluded.last_reason,
    opened_at=case when excluded.circuit_state='OPEN' then coalesce(intelligence_reliability_state.opened_at,excluded.opened_at) else null end,
    recovered_at=coalesce(excluded.recovered_at,intelligence_reliability_state.recovered_at),
    last_transition_at=coalesce(excluded.last_transition_at,intelligence_reliability_state.last_transition_at),
    updated_at=now(),metadata=excluded.metadata
  `;
  if(transition.transition){
   await sql`
    insert into intelligence_reliability_events(
     component_id,previous_state,next_state,observed_state,required,reliability_score,reason,metadata
    ) values(
     ${component.id},${prior?.circuitState??'CLOSED'},${transition.circuitState},${component.state},
     ${component.required},${score},${transition.reason},${sql.json({rows:component.rows,ageMinutes:component.ageMinutes})}
    )
   `;
   await persistIncident(component,transition);
  }
 }

 const snapshot=await loadIntelligenceReliabilityState();
 const mode=modeFromRows(snapshot.rows,certification);
 const [run]=await sql`
  insert into intelligence_reliability_runs(
   model_version,system_mode,components_checked,open_components,half_open_components,
   opened_this_run,recovered_this_run,reliability_score,completed_at,metadata
  ) values(
   ${RELEASE.modelVersion},${mode},${certification.components.length},${snapshot.openComponents.length},
   ${snapshot.halfOpenComponents.length},${opened},${recovered},${snapshot.score},now(),
   ${sql.json({certificationState:certification.state,criticalCoverage:certification.criticalCoverage})}
  ) returning id
 `;
 return {configured:true,runId:Number(run?.id||0),mode,score:snapshot.score,opened,recovered,rows:snapshot.rows};
}

export function reliabilityOpen(snapshot:ReliabilitySnapshot,componentId:string){
 return snapshot.openComponents.includes(componentId);
}

export function applyReliabilityGuards(markets:Market[],snapshot:ReliabilitySnapshot){
 const open=new Set(snapshot.openComponents);
 const neutralize=(features:Record<string,number>)=>{
  const next={...features};
  if(open.has('schedule')){
   for(const key of ['scheduleRestEdge','scheduleTravelEdge','scheduleFatigueEdge','scheduleDensityEdge','scheduleCompositeEdge'])next[key]=0;
   next.scheduleContextConfidence=0;
  }
  if(open.has('venue')){
   for(const key of ['venueWeatherComposite','venueTotalEffect','venueHomeEdge','venuePaceEffect','venueTemperatureEffect','venueWindEffect','venuePrecipEffect','venueHumidityEffect','venueAltitudeEffect','venueSurfaceEffect'])next[key]=0;
   next.venueWeatherConfidence=0;
   next.venueVolatilityEffect=Math.max(next.venueVolatilityEffect||0,.35);
  }
  if(open.has('movement')){
   for(const key of ['marketProbabilityMove','marketRecentMove','marketPointMove','marketMoveVelocity','marketSteamSignal','marketReversalSignal','marketClosingLineSignal','marketSharpSignal'])next[key]=0;
   next.marketMovementConfidence=0;
   next.marketMovementVolatility=Math.max(next.marketMovementVolatility||0,.25);
  }
  return next;
 };
 const now=new Date().toISOString();
 return markets.map(m=>{
  const protective=snapshot.mode==='PROTECTIVE';
  const reliabilityScore=snapshot.score;
  const contextQuality=m.contextQuality
   ?{...m.contextQuality,recommendationReady:protective?false:m.contextQuality.recommendationReady}
   :m.contextQuality;
  return {
   ...m,
   sportFeatures:{
    ...neutralize(m.sportFeatures||{}),
    reliabilityScore,
    reliabilityMode:snapshot.mode==='NORMAL' ? 0 : snapshot.mode==='DEGRADED' ? .5 : 1,
    reliabilityCriticalOpen:snapshot.criticalOpen?1:0,
    reliabilityOpenCount:snapshot.openComponents.length,
    reliabilityHalfOpenCount:snapshot.halfOpenComponents.length
   },
   contextQuality,
   contextSources:[...new Set([...(m.contextSources||[]),'reliability-supervisor'])],
   contextProvenance:[...(m.contextProvenance||[]),{
    source:'reliability-supervisor',providerId:'edgeforce-v72-reliability',field:'reliabilityScore',
    observedAt:now,confidence:reliabilityScore,status:snapshot.mode==='NORMAL'?'LIVE':'DEGRADED',
    detail:{mode:snapshot.mode,openComponents:snapshot.openComponents,halfOpenComponents:snapshot.halfOpenComponents}
   } as ContextProvenance]
  };
 });
}

export async function loadReliabilitySummary(){
 const sql=db();
 const current=await loadIntelligenceReliabilityState();
 if(!sql)return {...current,recentEvents:[],latestRun:null};
 try{
  const [events,runs]=await Promise.all([
   sql`
    select id,component_id as "componentId",previous_state as "previousState",next_state as "nextState",
     observed_state as "observedState",required,reliability_score::float as "reliabilityScore",reason,created_at as "createdAt"
    from intelligence_reliability_events order by created_at desc limit 40
   `,
   sql`
    select id,model_version as "modelVersion",system_mode as "systemMode",components_checked as "componentsChecked",
     open_components as "openComponents",half_open_components as "halfOpenComponents",opened_this_run as "openedThisRun",
     recovered_this_run as "recoveredThisRun",reliability_score::float as "reliabilityScore",started_at as "startedAt",completed_at as "completedAt"
    from intelligence_reliability_runs order by started_at desc limit 1
   `
  ]);
  return {...current,recentEvents:events,latestRun:(runs as any[])[0]||null};
 }catch{return {...current,recentEvents:[],latestRun:null}}
}
