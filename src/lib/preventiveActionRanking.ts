import {db} from './db';
import {buildPredictiveIncidentRisk} from './predictiveIncidentRisk';
import {loadPreventiveActionLearningSummary,normalizeActionKey} from './preventiveActionLearning';
import {RELEASE} from './releaseManifest';

export type RankedPreventiveAction={
 cause:string;
 actionKey:string;
 actionText:string;
 priorityScore:number;
 effectivenessScore:number;
 confidence:number;
 sourceRiskScore:number;
 evidenceQuality:'NEW'|'LIMITED'|'MODERATE'|'STRONG';
 reason:string[];
};

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function rankPreventiveActions(
 cause:string,
 sourceRiskScore:number,
 candidateActions:string[],
 learnedProfiles:Array<{cause:string;actionKey:string;effectivenessScore:number;confidence:number;sampleSize:number}>
):RankedPreventiveAction[]{
 const learnedByKey=new Map(
  learnedProfiles
   .filter(p=>p.cause===cause)
   .map(p=>[p.actionKey,p])
 );
 const seen=new Set<string>();
 const ranked:RankedPreventiveAction[]=[];
 for(const actionText of candidateActions){
  const actionKey=normalizeActionKey(actionText);
  if(seen.has(actionKey))continue;
  seen.add(actionKey);
  const learned=learnedByKey.get(actionKey);
  const effectivenessScore=learned?.effectivenessScore??.5;
  const confidence=learned?.confidence??0;
  const sampleSize=learned?.sampleSize??0;
  const evidenceQuality:RankedPreventiveAction['evidenceQuality']=
   sampleSize>=8&&confidence>=.8?'STRONG':
   sampleSize>=4&&confidence>=.45?'MODERATE':
   sampleSize>=1?'LIMITED':'NEW';
  const noveltyBoost=sampleSize===0?.04:0;
  const priorityScore=clamp(
   sourceRiskScore*.45+
   effectivenessScore*.35+
   confidence*.16+
   noveltyBoost
  );
  const reason=[
   `Current ${cause} risk is ${Math.round(sourceRiskScore*100)}%.`,
   sampleSize
    ?`Learned effectiveness is ${Math.round(effectivenessScore*100)}% from ${sampleSize} evaluated window(s).`
    :'No direct effectiveness history yet; ranking uses neutral prior evidence.',
   `Evidence quality: ${evidenceQuality}.`
  ];
  ranked.push({cause,actionKey,actionText,priorityScore,effectivenessScore,confidence,sourceRiskScore,evidenceQuality,reason});
 }
 return ranked.sort((a,b)=>b.priorityScore-a.priorityScore||b.confidence-a.confidence);
}

export async function buildPreventiveActionRanking(context?:{
 risk?:Awaited<ReturnType<typeof buildPredictiveIncidentRisk>>;
 learning?:{profiles?:any[]};
}){
 const [risk,learning]=await Promise.all([
  context?.risk?Promise.resolve(context.risk):buildPredictiveIncidentRisk(),
  context?.learning?Promise.resolve(context.learning):loadPreventiveActionLearningSummary()
 ]);
 const predicted=risk.componentRisks.find(x=>x.cause===risk.predictedCause)||risk.componentRisks[0];
 const cause=risk.predictedCause;
 const candidates=predicted?.preventiveActions||risk.preventiveActions||[];
 const learnedProfiles=(learning.profiles as any[]).map(p=>({
  cause:String(p.cause),
  actionKey:String(p.actionKey),
  effectivenessScore:Number(p.effectivenessScore||0),
  confidence:Number(p.confidence||0),
  sampleSize:Number(p.sampleSize||0)
 }));
 const recommendations=rankPreventiveActions(cause,risk.riskScore,candidates,learnedProfiles);
 const top=recommendations[0]||null;
 return {
  generatedAt:new Date().toISOString(),
  predictedCause:cause,
  sourceRiskScore:risk.riskScore,
  sourceRiskLevel:risk.riskLevel,
  topRecommendation:top,
  recommendations,
  decision:'ADVISORY_ONLY',
  notes:[
   'V79 ranks candidate safeguards using current predictive risk plus V78 learned effectiveness evidence.',
   'Recommendations remain operator-confirmed and never execute automatically.'
  ]
 };
}

export async function persistPreventiveActionRanking(report:Awaited<ReturnType<typeof buildPreventiveActionRanking>>){
 const sql=db();if(!sql)return {persisted:false};
 const top=report.topRecommendation;
 await sql`
  insert into preventive_action_ranking_snapshots(
   model_version,predicted_cause,source_risk_score,source_risk_level,
   top_action_key,top_action_text,top_priority_score,recommendations
  ) values(
   ${RELEASE.modelVersion},${report.predictedCause},${report.sourceRiskScore},${report.sourceRiskLevel},
   ${top?.actionKey||null},${top?.actionText||null},${top?.priorityScore||0},
   ${sql.json(report.recommendations as any)}
  )
 `;
 return {persisted:true};
}

export async function runPreventiveActionRanking(context?:Parameters<typeof buildPreventiveActionRanking>[0]){
 const report=await buildPreventiveActionRanking(context);
 const persistence=await persistPreventiveActionRanking(report);
 return {...report,persistence};
}

export async function loadPreventiveActionRankingSummary(){
 const current=await buildPreventiveActionRanking();
 const sql=db();if(!sql)return {...current,recent:[]};
 try{
  const recent=await sql`
   select id,model_version as "modelVersion",predicted_cause as "predictedCause",
    source_risk_score::float as "sourceRiskScore",source_risk_level as "sourceRiskLevel",
    top_action_key as "topActionKey",top_action_text as "topActionText",
    top_priority_score::float as "topPriorityScore",generated_at as "generatedAt"
   from preventive_action_ranking_snapshots
   order by generated_at desc limit 20
  `;
  return {...current,recent};
 }catch{return {...current,recent:[]}}
}
