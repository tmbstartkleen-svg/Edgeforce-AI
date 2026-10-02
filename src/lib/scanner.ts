import type {Market,Ranked,RiskProfile} from './types';
import {rankMarkets} from './engine';
import {simulateMarketsV22Detailed} from './simulationV22';

export type Scanned=Ranked & {
 simulationRuns:number;
 simProbability:number;
 simCi:[number,number];
 simulationMode:'event-monte-carlo'|'player-projection'|'probability-fallback';
 daysOut:number;
 bucket:'TODAY'|'WEEK';
 freshness:'FRESH'|'AGING'|'STALE';
};

export type ScanBundle={rows:Scanned[];hitVectors:Map<string,Uint8Array>};

export function scanMarketsWithOutcomes(rows:Market[],risk:RiskProfile='Moderate',now=new Date()):ScanBundle{
 const ranked=rankMarkets(rows,risk);
 const simulated=simulateMarketsV22Detailed(ranked,10000);
 const scanned=ranked.map((r):Scanned=>{
  const sim=simulated.summaries.get(r.id);
  const daysOut=Math.max(0,(new Date(r.startTime).getTime()-now.getTime())/86400000);
  const freshness:Scanned['freshness']=r.sourceAgeMin<=5?'FRESH':r.sourceAgeMin<=20?'AGING':'STALE';
  const bucket:Scanned['bucket']=daysOut<1?'TODAY':'WEEK';
  const probability=sim?.probability??r.modelProb;
  const ci:[number,number]=sim?[sim.ciLow,sim.ciHigh]:[probability,probability];
  return {...r,simulationRuns:sim?.runs??10000,simProbability:probability,simCi:ci,simulationMode:sim?.mode??'probability-fallback',daysOut,bucket,freshness};
 }).filter(x=>x.daysOut<=8);
 const ids=new Set(scanned.map(x=>x.id));
 const hitVectors=new Map<string,Uint8Array>();
 for(const [id,vector] of simulated.outcomes)if(ids.has(id))hitVectors.set(id,vector);
 return {rows:scanned,hitVectors};
}

export function scanMarkets(rows:Market[],risk:RiskProfile='Moderate',now=new Date()):Scanned[]{
 return scanMarketsWithOutcomes(rows,risk,now).rows;
}

export function todayTop30(rows:Market[],risk:RiskProfile='Moderate',now=new Date()){
 return scanMarkets(rows,risk,now).filter(x=>x.bucket==='TODAY'&&x.grade!=='PASS'&&x.simulationMode!=='probability-fallback'&&x.simProbability>=.65).sort((a,b)=>b.simProbability-a.simProbability).slice(0,30);
}
export function weekTop30(rows:Market[],risk:RiskProfile='Moderate',now=new Date()){
 return scanMarkets(rows,risk,now).filter(x=>x.grade!=='PASS'&&x.simulationMode!=='probability-fallback'&&x.simProbability>=.65).sort((a,b)=>b.simProbability-a.simProbability).slice(0,30);
}
