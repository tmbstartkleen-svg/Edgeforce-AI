import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{i as n}from"./incidentPatternLearning-BC9OlcsF.js";import{r}from"./predictiveIncidentRisk-KpbzZiS2.js";import{a as i}from"./preventiveActionLearning-D5uPnDdu.js";import{i as a}from"./preventiveActionRanking-rhlTeevM.js";import{r as o}from"./preventiveDecisionCalibration-B_erbWue.js";import{r as s}from"./preventiveThresholdStability-B6cr-8r-.js";import{i as c}from"./preventiveThresholdRecovery-Dn_NL5jw.js";import{i as l}from"./preventiveThresholdProbation-36jOuLtj.js";import{r as u}from"./preventiveBaselineGovernanceCycle-ZYixoUDj.js";import{n as d,r as f}from"./preventiveDecisionThresholds-Df9B5SNA.js";import{r as p}from"./preventiveActionDecisionGate-BB58xC5z.js";function m(e=new Date){let n=new Date(e);return n.setUTCSeconds(0,0),`${t.modelVersion}:${n.toISOString()}`}async function h(t){let n=e();if(!n)return null;let[r]=await n`
  select cycle_key as "cycleKey",status,reused_context_count as "reusedContextCount",
   step_count as "stepCount",evidence_digest as "evidenceDigest",outputs
  from preventive_supervision_cycle_snapshots
  where cycle_key=${t} and status='COMPLETED'
 `;return r||null}function g(e){return e.alreadyCompleted?{status:`SKIPPED_IDEMPOTENT`,run:!1}:e.lockAvailable?{status:`RUN`,run:!0}:{status:`SKIPPED_LOCKED`,run:!1}}async function _(n){let r=e();if(!r)return{acquired:!1,token:null};let i=await r`
  update preventive_supervision_cycle_state
  set lock_token=${`${t.modelVersion}:${Date.now()}:${Math.random().toString(36).slice(2)}`},locked_until=now()+interval '5 minutes',cycle_key=${n},updated_at=now()
  where singleton_key=1 and (locked_until is null or locked_until<now())
  returning lock_token
 `;return{acquired:i.length===1,token:i?.[0]?.lock_token?String(i[0].lock_token):null}}async function v(t){let n=e();!n||!t||await n`
  update preventive_supervision_cycle_state
  set lock_token=null,locked_until=null,updated_at=now()
  where singleton_key=1 and lock_token=${t}
 `}async function y(n){let r=e();r&&(await r`
  insert into preventive_supervision_cycle_snapshots(cycle_key,model_version,status)
  values(${n},${t.modelVersion},'STARTED')
  on conflict(cycle_key) do update set
   status='STARTED',model_version=excluded.model_version,started_at=now(),completed_at=null,error_text=null
 `,await r`
  insert into preventive_supervision_cycle_state(singleton_key,cycle_key,status,reused_context_count,step_count,last_reason,updated_at)
  values(1,${n},'STARTED',0,0,'Unified supervision cycle started.',now())
  on conflict(singleton_key) do update set cycle_key=excluded.cycle_key,status=excluded.status,
   reused_context_count=0,step_count=0,last_reason=excluded.last_reason,updated_at=now()
 `)}async function b(t){let n=e();n&&(await n`
  update preventive_supervision_cycle_snapshots
  set status=${t.status},reused_context_count=${t.reusedContextCount},step_count=${t.stepCount},
   evidence_digest=${n.json(t.evidenceDigest)},outputs=${n.json(t.outputs)},
   error_text=${t.errorText||null},completed_at=now()
  where cycle_key=${t.key}
 `,await n`
  update preventive_supervision_cycle_state
  set cycle_key=${t.key},status=${t.status},reused_context_count=${t.reusedContextCount},
   step_count=${t.stepCount},last_reason=${t.errorText||`Unified supervision cycle completed.`},updated_at=now()
  where singleton_key=1
 `)}async function x(t){let x=e(),S=m();if(!x)return{configured:!1,cycleKey:S,status:`FAILED`,reusedContextCount:0,stepCount:0,reason:`Database is not configured.`};let C=await h(S),w=await _(S);if(!g({alreadyCompleted:!!C,lockAvailable:w.acquired}).run)return w.acquired&&await v(w.token).catch(()=>void 0),C?{configured:!0,...C,status:`SKIPPED_IDEMPOTENT`,reason:`This minute-bucket supervision cycle already completed.`}:{configured:!0,cycleKey:S,status:`SKIPPED_LOCKED`,reusedContextCount:0,stepCount:0,reason:`Another unified supervision cycle holds the active lease.`};await y(S);let T={},E=0;try{let e=await n();E++,T.patterns={dominantCause:e.dominantCause,recurrenceScore:e.recurrenceScore,systemRisk:e.systemRisk};let m=await r({patterns:e,observability:t.observability});E++,T.predictiveRisk={predictedCause:m.predictedCause,riskScore:m.riskScore,riskLevel:m.riskLevel};let h=await i();E++,T.actionLearning={evaluatedNow:h.evaluatedNow,evaluatedEvents:h.evaluatedEvents,profileCount:h.profiles.length};let g=await a({risk:m,learning:h});E++,T.ranking={predictedCause:g.predictedCause,topActionKey:g.topRecommendation?.actionKey||null,topPriorityScore:g.topRecommendation?.priorityScore||0};let _=await o();E++,T.calibration={sampleSize:_.sampleSize,brierScore:_.brierScore,calibrationError:_.calibrationError};let v=await c();E++,T.recovery={state:v.state,adaptiveReentryAllowed:v.adaptiveReentryAllowed};let y=await l();E++,T.probation={state:y.state,adaptiveWeight:y.adaptiveWeight};let x=await u();E++,T.baselineGovernance={status:x.status,cycleKey:x.cycleKey};let C=await f({calibration:_});E++,T.thresholdGovernor={mode:C.mode,governorState:C.governorState,recommendThreshold:C.recommendThreshold};let w=await s();E++,T.stability={status:w.status,rollbackApplied:w.rollbackApplied,instabilityScore:w.instabilityScore};let D=await d(),O=await p({ranking:g,observability:t.observability,thresholds:D});E++,T.decision={decision:O.decision,gateScore:O.gateScore,actionKey:O.topAction?.actionKey||null};let k={observability:{overall:String(t.observability.overall),score:Number(t.observability.score||0),criticalChecks:Number(t.observability.summary?.critical||0),actionIncidents:Number(t.observability.incidents?.action||0)},predictedRisk:{cause:m.predictedCause,score:m.riskScore,level:m.riskLevel},calibration:{sampleSize:_.sampleSize,brierScore:_.brierScore,error:_.calibrationError},effectiveThresholds:{recommendThreshold:D.recommendThreshold,confidenceFloor:D.confidenceFloor,riskFloor:D.riskFloor,rejectEffectivenessCeiling:D.rejectEffectivenessCeiling}};return await b({key:S,status:`COMPLETED`,reusedContextCount:8,stepCount:E,evidenceDigest:k,outputs:T}),{configured:!0,cycleKey:S,status:`COMPLETED`,reusedContextCount:8,stepCount:E,evidenceDigest:k,outputs:T,decision:O}}catch(e){let t=e instanceof Error?e.message:`unified supervision cycle failed`;return await b({key:S,status:`FAILED`,reusedContextCount:8,stepCount:E,evidenceDigest:{},outputs:T,errorText:t}).catch(()=>void 0),{configured:!0,cycleKey:S,status:`FAILED`,reusedContextCount:8,stepCount:E,reason:t,outputs:T}}finally{await v(w.token).catch(()=>void 0)}}async function S(){let t=e();if(!t)return{status:`UNCONFIGURED`,cycleKey:null,reusedContextCount:0,stepCount:0,recent:[]};try{let[e]=await t`
   select cycle_key as "cycleKey",status,reused_context_count as "reusedContextCount",
    step_count as "stepCount",last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_supervision_cycle_state where singleton_key=1
  `,n=await t`
   select id,cycle_key as "cycleKey",model_version as "modelVersion",status,
    reused_context_count as "reusedContextCount",step_count as "stepCount",
    started_at as "startedAt",completed_at as "completedAt",error_text as "errorText"
   from preventive_supervision_cycle_snapshots order by started_at desc limit 20
  `;return{...e,rationale:e?.lastReason?[String(e.lastReason)]:[],recent:n}}catch{return{status:`UNKNOWN`,cycleKey:null,reusedContextCount:0,stepCount:0,recent:[]}}}export{S as n,x as r,g as t};