import type {Market,Ranked,RiskProfile} from './types';
import {rankMarkets} from './engine';
import {simulationTier,runBernoulliSimulation} from './simulation';

export type Scanned=Ranked & {simulationRuns:number;simProbability:number;simCi:[number,number];daysOut:number;bucket:'TODAY'|'WEEK';freshness:'FRESH'|'AGING'|'STALE'};

export function scanMarkets(rows:Market[],risk:RiskProfile='Moderate',now=new Date()):Scanned[]{
 return rankMarkets(rows,risk).map(r=>{
  const runs=simulationTier(r.edge,r.confidence);
  const sim=runBernoulliSimulation(r,runs);
  const daysOut=Math.max(0,(new Date(r.startTime).getTime()-now.getTime())/86400000);
  const freshness=r.sourceAgeMin<=5?'FRESH':r.sourceAgeMin<=20?'AGING':'STALE';
  return {...r,simulationRuns:runs,simProbability:sim.probability,simCi:[sim.ciLow,sim.ciHigh],daysOut,bucket:daysOut<1?'TODAY':'WEEK',freshness};
 }).filter(x=>x.daysOut<=8);
}

export function todayTop30(rows:Market[],risk:RiskProfile='Moderate',now=new Date()){
 return scanMarkets(rows,risk,now).filter(x=>x.bucket==='TODAY'&&x.grade!=='PASS').slice(0,30);
}
export function weekTop30(rows:Market[],risk:RiskProfile='Moderate',now=new Date()){
 return scanMarkets(rows,risk,now).filter(x=>x.grade!=='PASS').slice(0,30);
}
