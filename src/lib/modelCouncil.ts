import type {Market} from './types';
import {sportModel} from './sportModels';

export type Vote={name:string;prob:number;weight:number};

export function modelCouncil(m:Market){
 const sport=sportModel(m,m.sportFeatures||{});
 const votes:Vote[]=[
  {name:'Market No-Vig',prob:Math.max(.02,Math.min(.98,m.marketProb-.01)),weight:.10},
  {name:'Sport Engine',prob:sport.adjustedProbability,weight:.18},
  {name:'Elo/Power',prob:m.modelProb*.98+.01,weight:.09},
  {name:'Bayesian',prob:m.modelProb*.99+.005,weight:.11},
  {name:'Monte Carlo',prob:m.modelProb,weight:.16},
  {name:'Matchup',prob:m.modelProb*.97+.015,weight:.09},
  {name:'Player/Usage',prob:m.modelProb*1.01-.005,weight:.10},
  {name:'Environment',prob:m.modelProb*.985+.008,weight:.06},
  {name:'Line Regime',prob:m.modelProb*.975+.013,weight:.05},
  {name:'Historical Analog',prob:m.modelProb*.99+.006,weight:.06}
 ];
 const w=votes.reduce((s,v)=>s+v.weight,0);
 const ensemble=votes.reduce((s,v)=>s+v.prob*v.weight,0)/w;
 const mean=votes.reduce((s,v)=>s+v.prob,0)/votes.length;
 const dispersion=Math.sqrt(votes.reduce((s,v)=>s+(v.prob-mean)**2,0)/votes.length);
 const agreement=Math.max(0,Math.min(1,1-dispersion/.12));
 return {votes,ensemble,dispersion,agreement,sport};
}
