import {calculateEdgeValue} from './edgeValue';

export type ProbabilityEvidence = {
  probability: number;
  modelId: string;
  modelVersion: string;
  trainedThrough: string;
  generatedAt: string;
  independentOfTargetBook: boolean;
  outOfSampleSettledCount: number;
  outOfSampleBrierScore: number | null;
  features: Array<{name:string; source:string; observedAt:string}>;
};
export type VerifiedModelValue = {
  status:'RESEARCH_ONLY'|'EVIDENCE_READY';
  reasons:string[];
  modelProbability:number|null;
  breakEvenPercent:number|null;
  edgePp:number|null;
  expectedRoiPercent:number|null;
  estimatedProfitOn100:number|null;
  evidence:ProbabilityEvidence;
};

/**
 * Fail closed: a large edge or many simulation iterations cannot stand in
 * for independent data lineage, freshness, and observed out-of-sample calibration.
 * Approval is research evidence readiness, not confirmation of profit.
 */
export function evaluateModelEvidence(
  odds:number,
  evidence:ProbabilityEvidence,
  nowIso:string,
  options:{minimumSettled?:number;maxFeatureAgeHours?:number;maxModelAgeHours?:number}={}
):VerifiedModelValue{
  const reasons:string[]=[];
  const now=Date.parse(nowIso);
  const predictionTime=Date.parse(evidence.generatedAt);
  const trainedThrough=Date.parse(evidence.trainedThrough);
  const maximumAge=options.maxModelAgeHours??24;
  const maximumFeatureAge=options.maxFeatureAgeHours??72;
  const minimumSettled=options.minimumSettled??200;
  if(!Number.isFinite(now))throw new RangeError('Invalid evaluation time');
  if(!Number.isFinite(evidence.probability)||evidence.probability<=0||evidence.probability>=1)reasons.push('INVALID_PROBABILITY');
  if(!evidence.modelId.trim()||!evidence.modelVersion.trim())reasons.push('MISSING_MODEL_IDENTITY');
  if(!evidence.independentOfTargetBook)reasons.push('NOT_INDEPENDENT_OF_TARGET_PRICE');
  if(!Number.isFinite(predictionTime)||predictionTime>now||now-predictionTime>maximumAge*3600000)reasons.push('STALE_MODEL_PREDICTION');
  if(!Number.isFinite(trainedThrough)||trainedThrough>predictionTime)reasons.push('INVALID_TRAINING_CUTOFF');
  if(!Number.isInteger(evidence.outOfSampleSettledCount)||evidence.outOfSampleSettledCount<minimumSettled)reasons.push('INSUFFICIENT_OUT_OF_SAMPLE_RESULTS');
  if(evidence.outOfSampleBrierScore===null||!Number.isFinite(evidence.outOfSampleBrierScore)||evidence.outOfSampleBrierScore<0||evidence.outOfSampleBrierScore>1)reasons.push('MISSING_CALIBRATION_METRIC');
  if(!evidence.features.length)reasons.push('NO_FEATURE_PROVENANCE');
  for(const item of evidence.features){
    const observed=Date.parse(item.observedAt);
    if(!item.name.trim()||!item.source.trim()||!Number.isFinite(observed)||observed>predictionTime||predictionTime-observed>maximumFeatureAge*3600000){
      reasons.push('INVALID_OR_STALE_FEATURE_PROVENANCE');break;
    }
  }
  let metrics:ReturnType<typeof calculateEdgeValue>|null=null;
  try{metrics=calculateEdgeValue(odds,evidence.probability);}catch{reasons.push('INVALID_ODDS_OR_PROBABILITY');}
  const ready=reasons.length===0;
  return {
    status:ready?'EVIDENCE_READY':'RESEARCH_ONLY',
    reasons,
    modelProbability:metrics?.modelProbability??null,
    breakEvenPercent:metrics?metrics.breakEvenProbability*100:null,
    edgePp:metrics?.probabilityEdgePp??null,
    expectedRoiPercent:metrics?.expectedRoiPercent??null,
    estimatedProfitOn100:metrics?metrics.expectedProfitPerDollarStaked*100:null,
    evidence
  };
}
