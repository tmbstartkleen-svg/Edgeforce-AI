import {db} from './db';
import {buildPreventiveActionRanking,type RankedPreventiveAction} from './preventiveActionRanking';
import {buildProductionObservability} from './productionObservability';
import {RELEASE} from './releaseManifest';
import {loadPreventiveDecisionThresholds,type PreventiveDecisionThresholds} from './preventiveDecisionThresholds';

export type PreventiveActionDecision='RECOMMEND'|'HOLD_FOR_EVIDENCE'|'DO_NOT_USE'|'NO_ACTION';

export type PreventiveActionGateResult={
 decision:PreventiveActionDecision;
 gateScore:number;
 topAction:RankedPreventiveAction|null;
 reasons:string[];
 predictedCause:string;
 sourceRiskScore:number;
 sourceRiskLevel:string;
};

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function evaluatePreventiveActionGate(input:{
 topAction:RankedPreventiveAction|null;
 sourceRiskScore:number;
 sourceRiskLevel:string;
 overallHealth:string;
 criticalChecks:number;
 actionIncidents:number;
 predictedCause:string;
 thresholds?:PreventiveDecisionThresholds;
}):PreventiveActionGateResult{
 const thresholds=input.thresholds||{recommendThreshold:.72,confidenceFloor:.45,riskFloor:.60,rejectEffectivenessCeiling:.38} as PreventiveDecisionThresholds;
 const a=input.topAction;
 if(!a){
  return {decision:'NO_ACTION',gateScore:0,topAction:null,reasons:['No ranked safeguard is currently available.'],predictedCause:input.predictedCause,sourceRiskScore:input.sourceRiskScore,sourceRiskLevel:input.sourceRiskLevel};
 }
 const healthPenalty=input.overallHealth==='CRITICAL'||input.criticalChecks>0||input.actionIncidents>0?.18:0;
 const score=clamp(
  a.priorityScore*.42+
  a.effectivenessScore*.24+
  a.confidence*.20+
  input.sourceRiskScore*.14-
  healthPenalty
 );
 const reasons=[
  `Priority score ${Math.round(a.priorityScore*100)}%.`,
  `Learned effectiveness ${Math.round(a.effectivenessScore*100)}% with ${Math.round(a.confidence*100)}% confidence.`,
  `Current predicted ${input.predictedCause} risk ${Math.round(input.sourceRiskScore*100)}%.`
 ];
 if(healthPenalty>0)reasons.push('Current system health is degraded enough to reduce recommendation strength.');
 let decision:PreventiveActionDecision;
 if(a.effectivenessScore<thresholds.rejectEffectivenessCeiling&&a.confidence>=thresholds.confidenceFloor)decision='DO_NOT_USE';
 else if(score>=thresholds.recommendThreshold&&a.confidence>=thresholds.confidenceFloor&&input.sourceRiskScore>=thresholds.riskFloor&&healthPenalty===0)decision='RECOMMEND';
 else decision='HOLD_FOR_EVIDENCE';
 return {decision,gateScore:score,topAction:a,reasons,predictedCause:input.predictedCause,sourceRiskScore:input.sourceRiskScore,sourceRiskLevel:input.sourceRiskLevel};
}

export async function buildPreventiveActionDecisionGate(){
 const [ranking,obs,thresholds]=await Promise.all([buildPreventiveActionRanking(),buildProductionObservability(),loadPreventiveDecisionThresholds()]);
 return {
  generatedAt:new Date().toISOString(),
  ...evaluatePreventiveActionGate({
   topAction:ranking.topRecommendation,
   sourceRiskScore:ranking.sourceRiskScore,
   sourceRiskLevel:ranking.sourceRiskLevel,
   overallHealth:String(obs.overall),
   criticalChecks:Number(obs.summary?.critical||0),
   actionIncidents:Number(obs.incidents?.action||0),
   predictedCause:ranking.predictedCause,
   thresholds
  }),
  systemHealth:{overall:obs.overall,criticalChecks:Number(obs.summary?.critical||0),actionIncidents:Number(obs.incidents?.action||0)},
  thresholds,
  advisoryOnly:true
 };
}

export async function persistPreventiveActionDecisionGate(report:Awaited<ReturnType<typeof buildPreventiveActionDecisionGate>>){
 const sql=db();if(!sql)return {persisted:false};
 await sql`
  insert into preventive_action_decision_snapshots(
   model_version,predicted_cause,source_risk_score,source_risk_level,decision,action_key,action_text,gate_score,reasons
  ) values(
   ${RELEASE.modelVersion},${report.predictedCause},${report.sourceRiskScore},${report.sourceRiskLevel},
   ${report.decision},${report.topAction?.actionKey||null},${report.topAction?.actionText||null},
   ${report.gateScore},${sql.json(report.reasons)}
  )
 `;
 return {persisted:true};
}

export async function runPreventiveActionDecisionGate(){
 const report=await buildPreventiveActionDecisionGate();
 const persistence=await persistPreventiveActionDecisionGate(report);
 return {...report,persistence};
}

export async function loadPreventiveActionDecisionSummary(){
 const current=await buildPreventiveActionDecisionGate();
 const sql=db();if(!sql)return {...current,recent:[]};
 try{
  const recent=await sql`
   select id,model_version as "modelVersion",predicted_cause as "predictedCause",source_risk_score::float as "sourceRiskScore",
    source_risk_level as "sourceRiskLevel",decision,action_key as "actionKey",action_text as "actionText",
    gate_score::float as "gateScore",generated_at as "generatedAt"
   from preventive_action_decision_snapshots order by generated_at desc limit 20
  `;
  return {...current,recent};
 }catch{return {...current,recent:[]}}
}
