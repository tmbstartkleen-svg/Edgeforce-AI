import type {Market} from './types';
export type Vote={name:string;prob:number;weight:number};
export function modelCouncil(m:Market){
 const votes:Vote[]=[
  {name:'Market No-Vig',prob:Math.max(.02,Math.min(.98,m.marketProb-.01)),weight:.12},
  {name:'Elo/Power',prob:m.modelProb*.98+.01,weight:.11},
  {name:'Bayesian',prob:m.modelProb*.99+.005,weight:.13},
  {name:'Monte Carlo',prob:m.modelProb,weight:.18},
  {name:'Matchup',prob:m.modelProb*.97+.015,weight:.11},
  {name:'Player/Usage',prob:m.modelProb*1.01-.005,weight:.12},
  {name:'Environment',prob:m.modelProb*.985+.008,weight:.08},
  {name:'Line Regime',prob:m.modelProb*.975+.013,weight:.07},
  {name:'Historical Analog',prob:m.modelProb*.99+.006,weight:.08}
 ];
 const w=votes.reduce((s,v)=>s+v.weight,0);
 const ensemble=votes.reduce((s,v)=>s+v.prob*v.weight,0)/w;
 const mean=votes.reduce((s,v)=>s+v.prob,0)/votes.length;
 const dispersion=Math.sqrt(votes.reduce((s,v)=>s+(v.prob-mean)**2,0)/votes.length);
 const agreement=Math.max(0,Math.min(1,1-dispersion/.12));
 return {votes,ensemble,dispersion,agreement};
}