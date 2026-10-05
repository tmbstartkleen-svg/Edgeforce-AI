import {db} from './db';
import {RELEASE} from './releaseManifest';
import {runIncidentPatternLearning} from './incidentPatternLearning';
import {runPredictiveIncidentRisk} from './predictiveIncidentRisk';
import {runPreventiveActionLearning} from './preventiveActionLearning';
import {runPreventiveActionRanking} from './preventiveActionRanking';
import {runPreventiveDecisionCalibration} from './preventiveDecisionCalibration';
import {runThresholdRecoveryGovernor} from './preventiveThresholdRecovery';
import {runThresholdProbationGovernor} from './preventiveThresholdProbation';
import {runBaselineGovernanceCycle} from './preventiveBaselineGovernanceCycle';
import {runPreventiveDecisionThresholdGovernor,loadPreventiveDecisionThresholds} from './preventiveDecisionThresholds';
import {runThresholdStabilityGovernor} from './preventiveThresholdStability';
import {runPreventiveActionDecisionGate} from './preventiveActionDecisionGate';
import {buildProductionObservability} from './productionObservability';

export type SupervisionCycleStatus='COMPLETED'|'FAILED'|'SKIPPED_IDEMPOTENT';

function cycleKey(now=new Date()){
 const d=new Date(now);
 d.setUTCSeconds(0,0);
 return `${RELEASE.modelVersion}:${d.toISOString()}`;
}

async function completedCycle(key:string){
 const sql=db();if(!sql)return null;
 const [row]=await sql`
  select cycle_key as "cycleKey",status,reused_context_count as "reusedContextCount",
   step_count as "stepCount",evidence_digest as "evidenceDigest",outputs
  from preventive_supervision_cycle_snapshots
  where cycle_key=${key} and status='COMPLETED'
 `;
 return row||null;
}

async function recordStart(key:string){
 const sql=db();if(!sql)return;
 await sql`
  insert into preventive_supervision_cycle_snapshots(cycle_key,model_version,status)
  values(${key},${RELEASE.modelVersion},'STARTED')
  on conflict(cycle_key) do update set
   status='STARTED',model_version=excluded.model_version,started_at=now(),completed_at=null,error_text=null
 `;
 await sql`
  insert into preventive_supervision_cycle_state(singleton_key,cycle_key,status,reused_context_count,step_count,last_reason,updated_at)
  values(1,${key},'STARTED',0,0,'Unified supervision cycle started.',now())
  on conflict(singleton_key) do update set cycle_key=excluded.cycle_key,status=excluded.status,
   reused_context_count=0,step_count=0,last_reason=excluded.last_reason,updated_at=now()
 `;
}

async function recordFinish(input:{
 key:string;
 status:'COMPLETED'|'FAILED';
 reusedContextCount:number;
 stepCount:number;
 evidenceDigest:Record<string,unknown>;
 outputs:Record<string,unknown>;
 errorText?:string;
}){
 const sql=db();if(!sql)return;
 await sql`
  update preventive_supervision_cycle_snapshots
  set status=${input.status},reused_context_count=${input.reusedContextCount},step_count=${input.stepCount},
   evidence_digest=${sql.json(input.evidenceDigest as any)},outputs=${sql.json(input.outputs as any)},
   error_text=${input.errorText||null},completed_at=now()
  where cycle_key=${input.key}
 `;
 await sql`
  update preventive_supervision_cycle_state
  set cycle_key=${input.key},status=${input.status},reused_context_count=${input.reusedContextCount},
   step_count=${input.stepCount},last_reason=${input.errorText||'Unified supervision cycle completed.'},updated_at=now()
  where singleton_key=1
 `;
}

export async function runPreventiveSupervisionCycle(input:{
 observability:Awaited<ReturnType<typeof buildProductionObservability>>;
}){
 const sql=db();
 const key=cycleKey();
 if(!sql)return {configured:false,cycleKey:key,status:'FAILED' as SupervisionCycleStatus,reusedContextCount:0,stepCount:0,reason:'Database is not configured.'};

 const prior=await completedCycle(key);
 if(prior){
  return {configured:true,...prior,status:'SKIPPED_IDEMPOTENT' as SupervisionCycleStatus,reason:'This minute-bucket supervision cycle already completed.'};
 }

 await recordStart(key);
 const outputs:Record<string,unknown>={};
 let stepCount=0;
 const reusedContextCount=8;

 try{
  const patterns=await runIncidentPatternLearning(); stepCount++; outputs.patterns={dominantCause:patterns.dominantCause,recurrenceScore:patterns.recurrenceScore,systemRisk:patterns.systemRisk};
  const predictiveRisk=await runPredictiveIncidentRisk({patterns,observability:input.observability}); stepCount++; outputs.predictiveRisk={predictedCause:predictiveRisk.predictedCause,riskScore:predictiveRisk.riskScore,riskLevel:predictiveRisk.riskLevel};
  const actionLearning=await runPreventiveActionLearning(); stepCount++; outputs.actionLearning={evaluatedNow:actionLearning.evaluatedNow,evaluatedEvents:actionLearning.evaluatedEvents,profileCount:actionLearning.profiles.length};
  const ranking=await runPreventiveActionRanking({risk:predictiveRisk,learning:actionLearning}); stepCount++; outputs.ranking={predictedCause:ranking.predictedCause,topActionKey:ranking.topRecommendation?.actionKey||null,topPriorityScore:ranking.topRecommendation?.priorityScore||0};
  const calibration=await runPreventiveDecisionCalibration(); stepCount++; outputs.calibration={sampleSize:calibration.sampleSize,brierScore:calibration.brierScore,calibrationError:calibration.calibrationError};
  const recovery=await runThresholdRecoveryGovernor(); stepCount++; outputs.recovery={state:(recovery as any).state,adaptiveReentryAllowed:(recovery as any).adaptiveReentryAllowed};
  const probation=await runThresholdProbationGovernor(); stepCount++; outputs.probation={state:(probation as any).state,adaptiveWeight:(probation as any).adaptiveWeight};
  const baselineGovernance=await runBaselineGovernanceCycle(); stepCount++; outputs.baselineGovernance={status:(baselineGovernance as any).status,cycleKey:(baselineGovernance as any).cycleKey};
  const thresholdGovernor=await runPreventiveDecisionThresholdGovernor({calibration}); stepCount++; outputs.thresholdGovernor={mode:(thresholdGovernor as any).mode,governorState:(thresholdGovernor as any).governorState,recommendThreshold:(thresholdGovernor as any).recommendThreshold};
  const stability=await runThresholdStabilityGovernor(); stepCount++; outputs.stability={status:(stability as any).status,rollbackApplied:(stability as any).rollbackApplied,instabilityScore:(stability as any).instabilityScore};
  const effectiveThresholds=await loadPreventiveDecisionThresholds();
  const decision=await runPreventiveActionDecisionGate({ranking,observability:input.observability,thresholds:effectiveThresholds}); stepCount++; outputs.decision={decision:decision.decision,gateScore:decision.gateScore,actionKey:decision.topAction?.actionKey||null};

  const evidenceDigest={
   observability:{overall:String(input.observability.overall),score:Number(input.observability.score||0),criticalChecks:Number(input.observability.summary?.critical||0),actionIncidents:Number(input.observability.incidents?.action||0)},
   predictedRisk:{cause:predictiveRisk.predictedCause,score:predictiveRisk.riskScore,level:predictiveRisk.riskLevel},
   calibration:{sampleSize:calibration.sampleSize,brierScore:calibration.brierScore,error:calibration.calibrationError},
   effectiveThresholds:{
    recommendThreshold:effectiveThresholds.recommendThreshold,
    confidenceFloor:effectiveThresholds.confidenceFloor,
    riskFloor:effectiveThresholds.riskFloor,
    rejectEffectivenessCeiling:effectiveThresholds.rejectEffectivenessCeiling
   }
  };

  await recordFinish({key,status:'COMPLETED',reusedContextCount,stepCount,evidenceDigest,outputs});
  return {configured:true,cycleKey:key,status:'COMPLETED' as SupervisionCycleStatus,reusedContextCount,stepCount,evidenceDigest,outputs,decision};
 }catch(error){
  const message=error instanceof Error?error.message:'unified supervision cycle failed';
  await recordFinish({key,status:'FAILED',reusedContextCount,stepCount,evidenceDigest:{},outputs,errorText:message}).catch(()=>undefined);
  return {configured:true,cycleKey:key,status:'FAILED' as SupervisionCycleStatus,reusedContextCount,stepCount,reason:message,outputs};
 }
}

export async function loadPreventiveSupervisionCycleSummary(){
 const sql=db();if(!sql)return {status:'UNCONFIGURED',cycleKey:null,reusedContextCount:0,stepCount:0,recent:[]};
 try{
  const [state]=await sql`
   select cycle_key as "cycleKey",status,reused_context_count as "reusedContextCount",
    step_count as "stepCount",last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_supervision_cycle_state where singleton_key=1
  `;
  const recent=await sql`
   select id,cycle_key as "cycleKey",model_version as "modelVersion",status,
    reused_context_count as "reusedContextCount",step_count as "stepCount",
    started_at as "startedAt",completed_at as "completedAt",error_text as "errorText"
   from preventive_supervision_cycle_snapshots order by started_at desc limit 20
  `;
  return {...state,rationale:state?.lastReason?[String(state.lastReason)]:[],recent};
 }catch{return {status:'UNKNOWN',cycleKey:null,reusedContextCount:0,stepCount:0,recent:[]}}
}
