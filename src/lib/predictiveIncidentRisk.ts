import {db} from './db';
import {buildIncidentPatternLearning,type IncidentPatternProfile} from './incidentPatternLearning';
import {buildProductionObservability} from './productionObservability';
import {RELEASE} from './releaseManifest';

export type PredictiveRisk={
 cause:string;
 riskScore:number;
 riskLevel:'LOW'|'ELEVATED'|'HIGH'|'CRITICAL';
 horizonHours:number;
 evidence:string[];
 preventiveActions:string[];
};

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

function freshnessPressure(id:string,state:string){
 if(state==='CRITICAL')return .95;
 if(state==='DEGRADED')return .60;
 if(state==='UNKNOWN')return .35;
 return 0;
}

export function scorePredictiveRisk(
 profile:IncidentPatternProfile,
 currentChecks:Array<{id:string;state:string;reason:string}>
):PredictiveRisk{
 const map:Record<string,string[]>={
  DATABASE:['database'],
  MARKET_FRESHNESS:['market-freshness'],
  CONSENSUS_FRESHNESS:['consensus-freshness'],
  MODEL_FRESHNESS:['model-freshness'],
  AUTOMATION:['automation-health','automation-freshness'],
  RELIABILITY:['reliability-mode'],
  RUNTIME_INCIDENTS:['incidents']
 };
 const matching=currentChecks.filter(x=>(map[profile.cause]||[]).includes(x.id));
 const currentPressure=matching.reduce((m,x)=>Math.max(m,freshnessPressure(x.id,x.state)),0);
 const trendPressure=profile.trendScore;
 const severityPressure=profile.actionCount/Math.max(1,profile.sampleSize);
 const cofailurePressure=Math.min(1,profile.cofailureComponents.length/3);

 const riskScore=clamp(
  profile.recurrenceScore*.42+
  trendPressure*.20+
  severityPressure*.18+
  currentPressure*.15+
  cofailurePressure*.05
 );
 const riskLevel:PredictiveRisk['riskLevel']=riskScore>=.85?'CRITICAL':riskScore>=.70?'HIGH':riskScore>=.52?'ELEVATED':'LOW';
 const preventiveActions=[
  ...(profile.recommendedRunbook||[]).slice(0,2),
  riskLevel==='CRITICAL'||riskLevel==='HIGH'
   ?'Require a fresh healthy probe for the predicted subsystem before production promotion.'
   :'Continue normal monitoring and verify the subsystem before the next release window.'
 ];
 const evidence=[
  `30d recurrence ${Math.round(profile.recurrenceScore*100)}%`,
  `trend ${Math.round(profile.trendScore*100)}%`,
  `ACTION share ${Math.round(severityPressure*100)}%`,
  ...(matching.filter(x=>x.state!=='HEALTHY').map(x=>x.reason).slice(0,2)),
  ...(profile.cofailureComponents.length?[`co-failures: ${profile.cofailureComponents.join(', ')}`]:[])
 ];
 return {cause:profile.cause,riskScore,riskLevel,horizonHours:24,evidence,preventiveActions};
}

export async function buildPredictiveIncidentRisk(){
 const [patterns,obs]=await Promise.all([buildIncidentPatternLearning(),buildProductionObservability()]);
 const risks=patterns.profiles.map(p=>scorePredictiveRisk(p,obs.checks)).sort((a,b)=>b.riskScore-a.riskScore);
 const top=risks[0]||{
  cause:'NONE',riskScore:0,riskLevel:'LOW' as const,horizonHours:24,
  evidence:['No recurring incident pattern has enough evidence yet.'],
  preventiveActions:['Continue scheduled production observability and SLO supervision.']
 };
 const preventiveWarning=top.riskScore>=.70;
 return {
  generatedAt:new Date().toISOString(),
  horizonHours:24,
  predictedCause:top.cause,
  riskScore:top.riskScore,
  riskLevel:top.riskLevel,
  preventiveWarning,
  componentRisks:risks,
  preventiveActions:top.preventiveActions,
  evidence:top.evidence,
  notes:[
   'Predictive risk combines V76 recurrence/trend evidence with current production-health pressure.',
   'Warnings are preventive only and cannot place wagers, change champions, or bypass release/SLO controls.'
  ]
 };
}

export async function persistPredictiveIncidentRisk(report:Awaited<ReturnType<typeof buildPredictiveIncidentRisk>>){
 const sql=db();if(!sql)return {persisted:false};
 await sql`
  insert into predictive_incident_risk_snapshots(
   model_version,predicted_cause,risk_score,risk_level,horizon_hours,component_risks,preventive_actions,evidence
  ) values(
   ${RELEASE.modelVersion},${report.predictedCause},${report.riskScore},${report.riskLevel},${report.horizonHours},
   ${sql.json(report.componentRisks as any)},${sql.json(report.preventiveActions)},${sql.json(report.evidence)}
  )
 `;
 return {persisted:true};
}

export async function runPredictiveIncidentRisk(){
 const report=await buildPredictiveIncidentRisk();
 const persistence=await persistPredictiveIncidentRisk(report);
 return {...report,persistence};
}

export async function loadPredictiveIncidentRiskSummary(){
 const current=await buildPredictiveIncidentRisk();
 const sql=db();if(!sql)return {...current,recent:[]};
 try{
  const recent=await sql`
   select id,model_version as "modelVersion",predicted_cause as "predictedCause",risk_score::float as "riskScore",
    risk_level as "riskLevel",horizon_hours as "horizonHours",generated_at as "generatedAt"
   from predictive_incident_risk_snapshots order by generated_at desc limit 20
  `;
  return {...current,recent};
 }catch{return {...current,recent:[]}}
}
