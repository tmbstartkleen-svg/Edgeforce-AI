import type {Market,Ranked,RiskProfile} from './types';
import {rankMarkets} from './engine';
import {simulateMarketsV22} from './simulationV22';

export type Scanned=Ranked & {
 simulationRuns:number;
 simProbability:number;
 simCi:[number,number];
 simulationMode:'event-monte-carlo'|'player-projection'|'probability-fallback';
 daysOut:number;
 bucket:'TODAY'|'WEEK';
 freshness:'FRESH'|'AGING'|'STALE';
};

export function scanMarkets(rows:Market[],risk:RiskProfile='Moderate',now=new Date()):Scanned[]{
 const ranked=rankMarkets(rows,risk);
 const sims=simulateMarketsV22(ranked,10000);
 return ranked.map((r):Scanned=>{
  const sim=sims.get(r.id);
  const daysOut=Math.max(0,(new Date(r.startTime).getTime()-now.getTime())/86400000);
  const freshness:Scanned['freshness']=r.sourceAgeMin<=5?'FRESH':r.sourceAgeMin<=20?'AGING':'STALE';
  const bucket:Scanned['bucket']=daysOut<1?'TODAY':'WEEK';
  const probability=sim?.probability??r.modelProb;
  const ci:[number,number]=sim?[sim.ciLow,sim.ciHigh]:[probability,probability];
  return {...r,simulationRuns:sim?.runs??10000,simProbability:probability,simCi:ci,simulationMode:sim?.mode??'probability-fallback',daysOut,bucket,freshness};
 }).filter(x=>x.daysOut<=8);
}

export function todayTop30(rows:Market[],risk:RiskProfile='Moderate',now=new Date()){
 return scanMarkets(rows,risk,now).filter(x=>x.bucket==='TODAY'&&x.grade!=='PASS').sort((a,b)=>b.simProbability-a.simProbability).slice(0,30);
}
export function weekTop30(rows:Market[],risk:RiskProfile='Moderate',now=new Date()){
 return scanMarkets(rows,risk,now).filter(x=>x.grade!=='PASS').sort((a,b)=>b.simProbability-a.simProbability).slice(0,30);
}
