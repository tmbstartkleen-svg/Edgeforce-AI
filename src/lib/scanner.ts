import type {Market,Ranked,RiskProfile} from './types';
import {rankMarkets} from './engine';
import {simulationTier,runGameStateSimulation} from './simulation';
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
 dynamicConfidenceComponents:ReturnType<typeof calibrateDynamicConfidence>['components'] & {contextQuality?:number};
 daysOut:number;
 bucket:'TODAY'|'WEEK';
 freshness:'FRESH'|'AGING'|'STALE';
 simEngine:string;
 simProjection:{homeMean?:number;awayMean?:number;totalMean?:number;marginMean?:number;selectionMean?:number;line?:number;unit?:string;distributionFamily?:string;distributionConfidence?:number;p10?:number;p50?:number;p90?:number;microUnit?:string;microUnitCount?:number};
};

export function scanMarkets(rows:Market[],risk:RiskProfile='Moderate',now=new Date(),learnedWeights?:LearnedWeightMap,dynamicCalibration:DynamicCalibrationMap={}):Scanned[]{
 return rankMarkets(rows,risk,learnedWeights).map((r):Scanned=>{
  const runs=simulationTier(r.edge,r.confidence);
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
  const dynamicConfidence=Math.max(.18,Math.min(.98,calibrated.dynamicConfidence*contextMultiplier));
  const confidenceDowngrade=calibrated.confidenceLabel==='LOW'||calibrated.regime==='DISLOCATED';
  const contextDowngrade=Boolean(r.contextQuality&&!r.contextQuality.recommendationReady);
  let grade=r.grade;
  if(confidenceDowngrade||contextDowngrade)grade=grade==='ELITE'?'STRONG':grade==='STRONG'?'WATCH':grade;
  if((r.contextQuality?.criticalCoverage??1)<.34&&grade==='STRONG')grade='WATCH';
  const stakeScale=Math.max(.30,.50+.50*dynamicConfidence);
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
   dynamicConfidenceComponents:{...calibrated.components,contextQuality:contextScore},
   daysOut,bucket,freshness,simEngine:sim.engine,simProjection:sim.projection
  };
 }).filter(x=>x.daysOut>=0&&x.daysOut<=8);
}

export function todayTop30(rows:Market[],risk:RiskProfile='Moderate',now=new Date(),learnedWeights?:LearnedWeightMap,dynamicCalibration:DynamicCalibrationMap={}){
 return scanMarkets(rows,risk,now,learnedWeights,dynamicCalibration).filter(x=>x.bucket==='TODAY'&&x.grade!=='PASS').slice(0,30);
}
export function weekTop30(rows:Market[],risk:RiskProfile='Moderate',now=new Date(),learnedWeights?:LearnedWeightMap,dynamicCalibration:DynamicCalibrationMap={}){
 return scanMarkets(rows,risk,now,learnedWeights,dynamicCalibration).filter(x=>x.grade!=='PASS').slice(0,30);
}
