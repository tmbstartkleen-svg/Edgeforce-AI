import type {Market,Ranked,RiskProfile} from './types';
import {rankMarkets} from './engine';
import {simulationTier,runGameStateSimulation} from './simulation';
import {runSportOutcomeSimulation} from './sportOutcomeSimulation';
import type {LearnedWeightMap} from './learnedWeights';

export type Scanned=Ranked & {
 simulationRuns:number;
 simProbability:number;
 simCi:[number,number];
 daysOut:number;
 bucket:'TODAY'|'WEEK';
 freshness:'FRESH'|'AGING'|'STALE';
 simEngine:string;
 simProjection:{homeMean?:number;awayMean?:number;totalMean?:number;marginMean?:number;selectionMean?:number;line?:number;unit?:string;distributionFamily?:string;distributionConfidence?:number;p10?:number;p50?:number;p90?:number;microUnit?:string;microUnitCount?:number};
};

export function scanMarkets(rows:Market[],risk:RiskProfile='Moderate',now=new Date(),learnedWeights?:LearnedWeightMap):Scanned[]{
 return rankMarkets(rows,risk,learnedWeights).map((r):Scanned=>{
  const runs=simulationTier(r.edge,r.confidence);
  const sim=runSportOutcomeSimulation(r,runs,runGameStateSimulation);
  const daysOut=(new Date(r.startTime).getTime()-now.getTime())/86400000;
  const freshness:Scanned['freshness']=r.sourceAgeMin<=5?'FRESH':r.sourceAgeMin<=20?'AGING':'STALE';
  const bucket:Scanned['bucket']=daysOut<1?'TODAY':'WEEK';
  const simCi:[number,number]=[sim.ciLow,sim.ciHigh];
  return {...r,simulationRuns:sim.runs,simProbability:sim.probability,simCi,daysOut,bucket,freshness,simEngine:sim.engine,simProjection:sim.projection};
 }).filter(x=>x.daysOut>=0&&x.daysOut<=8);
}

export function todayTop30(rows:Market[],risk:RiskProfile='Moderate',now=new Date(),learnedWeights?:LearnedWeightMap){
 return scanMarkets(rows,risk,now,learnedWeights).filter(x=>x.bucket==='TODAY'&&x.grade!=='PASS').slice(0,30);
}
export function weekTop30(rows:Market[],risk:RiskProfile='Moderate',now=new Date(),learnedWeights?:LearnedWeightMap){
 return scanMarkets(rows,risk,now,learnedWeights).filter(x=>x.grade!=='PASS').slice(0,30);
}
