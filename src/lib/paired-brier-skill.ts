/**
 * Stage 2 paired Brier baseline study. Identical settled outcomes and forecast
 * cutoffs for the independent model and benchmark prevent mismatched-event
 * comparisons from masquerading as skill.
 * This does not authenticate the source of any supplied evidence.
 */
export type PairedForecast={
 eventId:string;marketId:string;outcomeId:string;forecastAt:string;settledAt:string;
 modelProbability:number;baselineProbability:number;result:0|1;
};
export function evaluatePairedBrierSkill(input:PairedForecast[],now=Date.now()){
 if(!Array.isArray(input)||input.length>50000||!Number.isFinite(now))
  throw Error('INVALID_PAIRED_BASELINE');
 const seen=new Set<string>();let modelLoss=0,baselineLoss=0,positive=0,negative=0;
 const rejected:Record<string,number>={};
 const reject=(reason:string)=>{rejected[reason]=(rejected[reason]||0)+1};
 for(const v of input){
  if(!v||![v.eventId,v.marketId,v.outcomeId].every(s=>typeof s==='string'&&s.trim())||
   ![v.modelProbability,v.baselineProbability].every(p=>typeof p==='number'&&Number.isFinite(p)&&p>0&&p<1)||
   (v.result!==0&&v.result!==1)){reject('INVALID_PAIRED_RECORD');continue}
  const forecast=Date.parse(v.forecastAt),settled=Date.parse(v.settledAt);
  if(!Number.isFinite(forecast)||!Number.isFinite(settled)||forecast>=settled||settled>now){
   reject('INVALID_PAIRED_TIME');continue
  }
  const id=JSON.stringify([v.eventId,v.marketId,v.outcomeId]);
  if(seen.has(id)){reject('DUPLICATE_OUTCOME');continue}
  seen.add(id);
  const ml=(v.modelProbability-v.result)**2,bl=(v.baselineProbability-v.result)**2;
  modelLoss+=ml;baselineLoss+=bl;
  if(ml<bl)positive++;else if(ml>bl)negative++;
 }
 const n=seen.size;
 const modelBrier=n?modelLoss/n:null,baselineBrier=n?baselineLoss/n:null;
 const improvement=n?(baselineLoss-modelLoss)/n:null;
 return {mode:'PAIRED_BRIER_SKILL_RESEARCH' as const,sampleSize:n,
  modelBrierScore:modelBrier,baselineBrierScore:baselineBrier,
  absoluteBrierImprovement:improvement,
  relativeBrierSkill:baselineBrier&&baselineBrier>0?(baselineBrier-modelBrier!)/baselineBrier:null,
  modelOutperformedCount:positive,baselineOutperformedCount:negative,
  minimumSampleMet:n>=100,observedImprovement:n>=100&&improvement!==null&&improvement>0,
  rejected,sourceProvenanceVerified:false,holdoutPartitionVerified:false,
  baselineProvenanceVerified:false,certified:false,
  note:'Observed Brier skill on supplied paired outcomes is not proof of genuine held-out validation or betting ROI.'};
}
