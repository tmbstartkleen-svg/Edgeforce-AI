import type {Market} from './types';

export type SimulationTier=100|1000|10000|100000;
export type SimulationResult={runs:SimulationTier;hits:number;probability:number;ciLow:number;ciHigh:number};

export function simulationTier(edge:number,confidence:number):SimulationTier{
 if(edge>=.08&&confidence>=.8)return 100000;
 if(edge>=.05&&confidence>=.72)return 10000;
 if(edge>=.025)return 1000;
 return 100;
}

export function runBernoulliSimulation(m:Market,runs:SimulationTier):SimulationResult{
 const p=Math.max(.01,Math.min(.99,m.modelProb));
 let hits=0;
 let state=hashSeed(m.id+m.startTime);
 for(let i=0;i<runs;i++){
  state=xorshift32(state);
  const u=(state>>>0)/4294967296;
  if(u<p)hits++;
 }
 const phat=hits/runs;
 const se=Math.sqrt(Math.max(.0000001,phat*(1-phat)/runs));
 return {runs,hits,probability:phat,ciLow:Math.max(0,phat-1.96*se),ciHigh:Math.min(1,phat+1.96*se)};
}
function hashSeed(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h||123456789}
function xorshift32(x:number){x^=x<<13;x^=x>>>17;x^=x<<5;return x|0}
