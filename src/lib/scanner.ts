import type {Market,Ranked,RiskProfile} from './types';
import {rankMarkets} from './engine';
import {simulationTier,runGameStateSimulation,type SimulationTier} from './simulation';
import {runSportOutcomeSimulation} from './sportOutcomeSimulation';
import type {LearnedWeightMap} from './learnedWeights';
import {calibrateDynamicConfidence,calibrationProfileKey,type DynamicCalibrationMap,type DynamicConfidenceLabel,type MarketRegime} from './regimeConfidence';

export type Scanned=Ranked & {
 simulationRuns:number;
 simProbability:number;
 rawSimProbability:number;
 simCi:[number,number];
 dynamicConfidence:number;
 uncertainty:number;
 confidenceLabel:DynamicConfidenceLabel;
 regime:MarketRegime;
 historicalShrinkage:number;
 consensusBlend:number;
 optimizerBlend?:{applied:boolean;scope:string;confidence:number;councilWeight:number;simulationWeight:number;marketWeight:number};
 intelligenceStackScore?:number;
 intelligenceCriticalCoverage?:number;
 intelligenceStackReady?:boolean;
 reliabilityMode?:'NORMAL'|'DEGRADED'|'PROTECTIVE';
 reliabilityScore?:number;
 reliabilityCriticalOpen?:boolean;
 dynamicConfidenceComponents:ReturnType<typeof calibrateDynamicConfidence>['components'] & {contextQuality?:number};
 daysOut:number;
 bucket:'TODAY'|'WEEK';
 freshness:'FRESH'|'AGING'|'STALE';
 simEngine:string;
 simProjection:{homeMean?:number;awayMean?:number;totalMean?:number;marginMean?:number;selectionMean?:number;line?:number;unit?:string;distributionFamily?:string;distributionConfidence?:number;p10?:number;p50?:number;p90?:number;microUnit?:string;microUnitCount?:number};
};

export type ScanOptions={
 simulationRunCap?:SimulationTier;
 minDaysOut?:number;
 maxDaysOut?:number;
};

export function scanMarkets(rows:Market[],risk:RiskProfile='Moderate',now=new Date(),learnedWeights?:LearnedWeightMap,dynamicCalibration:DynamicCalibrationMap={},options:ScanOptions={}):Scanned[]{
 return rankMarkets(rows,risk,learnedWeights).map((r):Scanned=>{
  const requestedRuns=simulationTier(r.edge,r.confidence);
  const runs=(options.simulationRunCap&&requestedRuns>options.simulationRunCap?options.simulationRunCap:requestedRuns) as SimulationTier;
  const sim=runSportOutcomeSimulation(r,runs,runGameStateSimulation);
  const profile=dynamicCalibration[calibrationProfileKey(r.sport,r.market)]??dynamicCalibration[calibrationProfileKey(r.sport,'*')]??dynamicCalibration[calibrationProfileKey('*','*')];
  const calibrated=calibrateDynamicConfidence({
   market:r,
   rawProbability:sim.probability,
   ci:[sim.ciLow,sim.ciHigh],
   modelAgreement:r.agreement,
   distributionConfidence:sim.projection.distributionConfidence,
   profile
  });
  const daysOut=(new Date(r.startTime).getTime()-now.getTime())/86400000;
  const freshness:Scanned['freshness']=r.sourceAgeMin<=5?'FRESH':r.sourceAgeMin<=20?'AGING':'STALE';
  const bucket:Scanned['bucket']=daysOut<1?'TODAY':'WEEK';
  const contextScore=r.contextQuality?.score??0;
  const contextMultiplier=.72+.28*contextScore;
  const intelligenceStackScore=Math.max(0,Math.min(1,Number(r.sportFeatures?.intelligenceStackScore??contextScore)));
  const intelligenceCriticalCoverage=Math.max(0,Math.min(1,Number(r.sportFeatures?.intelligenceCriticalCoverage??r.contextQuality?.criticalCoverage??contextScore)));
  const intelligenceStackReady=Number(r.sportFeatures?.intelligenceStackReady??1)>=.5;
  const intelligenceConfidenceScale=.90+.10*intelligenceStackScore;
  const reliabilityModeValue=Math.max(0,Math.min(1,Number(r.sportFeatures?.reliabilityMode??0)));
  const reliabilityMode:Scanned['reliabilityMode']=reliabilityModeValue>=.75?'PROTECTIVE':reliabilityModeValue>=.25?'DEGRADED':'NORMAL';
  const reliabilityScore=Math.max(0,Math.min(1,Number(r.sportFeatures?.reliabilityScore??1)));
  const reliabilityCriticalOpen=Number(r.sportFeatures?.reliabilityCriticalOpen??0)>=.5;
  const reliabilityConfidenceScale=reliabilityMode==='NORMAL'?1:reliabilityMode==='DEGRADED'?(.80+.15*reliabilityScore):.55;
  const dynamicConfidence=Math.max(.18,Math.min(.98,calibrated.dynamicConfidence*contextMultiplier*intelligenceConfidenceScale*reliabilityConfidenceScale));
  const confidenceDowngrade=calibrated.confidenceLabel==='LOW'||calibrated.regime==='DISLOCATED';
  const contextDowngrade=Boolean(r.contextQuality&&!r.contextQuality.recommendationReady);
  const intelligenceDowngrade=!intelligenceStackReady||intelligenceStackScore<.45||intelligenceCriticalCoverage<.42;
  const reliabilityDowngrade=reliabilityMode!=='NORMAL';
  let grade=r.grade;
  if(confidenceDowngrade||contextDowngrade||intelligenceDowngrade||reliabilityDowngrade)grade=grade==='ELITE'?'STRONG':grade==='STRONG'?'WATCH':grade;
  if((r.contextQuality?.criticalCoverage??1)<.34&&grade==='STRONG')grade='WATCH';
  if(intelligenceStackScore<.32&&grade!=='PASS')grade='WATCH';
  if(reliabilityMode==='PROTECTIVE'||reliabilityCriticalOpen)grade='PASS';
  const intelligenceStakeScale=intelligenceStackReady?(.85+.15*intelligenceStackScore):(.55+.25*intelligenceStackScore);
  const reliabilityStakeScale=reliabilityMode==='NORMAL'?1:reliabilityMode==='DEGRADED'?(.65+.20*reliabilityScore):0;
  const stakeScale=grade==='PASS'?0:Math.max(.15,(.50+.50*dynamicConfidence)*intelligenceStakeScale*reliabilityStakeScale);
  return {
   ...r,
   grade,
   recommendedStake:r.recommendedStake*stakeScale,
   simulationRuns:sim.runs,
   rawSimProbability:sim.probability,
   simProbability:calibrated.calibratedProbability,
   simCi:calibrated.calibratedCi,
   dynamicConfidence,
   uncertainty:calibrated.uncertainty,
   confidenceLabel:calibrated.confidenceLabel,
   regime:calibrated.regime,
   historicalShrinkage:calibrated.historicalShrinkage,
   consensusBlend:calibrated.consensusBlend,
   optimizerBlend:calibrated.optimizerBlend,
   intelligenceStackScore,
   intelligenceCriticalCoverage,
   intelligenceStackReady,
   reliabilityMode,
   reliabilityScore,
   reliabilityCriticalOpen,
   dynamicConfidenceComponents:{...calibrated.components,contextQuality:contextScore},
   daysOut,bucket,freshness,simEngine:sim.engine,simProjection:sim.projection
  };
 }).filter(x=>x.daysOut>=(options.minDaysOut??0)&&x.daysOut<=(options.maxDaysOut??8));
}

export function todayTop30(rows:Market[],risk:RiskProfile='Moderate',now=new Date(),learnedWeights?:LearnedWeightMap,dynamicCalibration:DynamicCalibrationMap={}){
 return scanMarkets(rows,risk,now,learnedWeights,dynamicCalibration).filter(x=>x.bucket==='TODAY'&&x.grade!=='PASS').slice(0,30);
}
export function weekTop30(rows:Market[],risk:RiskProfile='Moderate',now=new Date(),learnedWeights?:LearnedWeightMap,dynamicCalibration:DynamicCalibrationMap={}){
 return scanMarkets(rows,risk,now,learnedWeights,dynamicCalibration).filter(x=>x.grade!=='PASS').slice(0,30);
}
