import type {Market} from './types';
import {sportModel} from './sportModels';
import {learnedMultiplier,type LearnedWeightMap} from './learnedWeights';

export type Vote={name:string;prob:number;baseWeight:number;learnedMultiplier:number;weight:number};

const clamp=(x:number,min=.01,max=.99)=>Math.max(min,Math.min(max,x));
const logit=(p:number)=>Math.log(clamp(p)/(1-clamp(p)));
const logistic=(x:number)=>1/(1+Math.exp(-x));
const f=(m:Market,k:string)=>Math.max(-1,Math.min(1,Number(m.sportFeatures?.[k]||0)));
const shift=(base:number,delta:number)=>clamp(logistic(logit(base)+delta));

export function modelCouncil(m:Market,learnedWeights?:LearnedWeightMap){
 const sport=sportModel(m,m.sportFeatures||{});
 const confidence=Math.max(.2,Math.min(1,m.confidence));
 const powerSignal=.16*f(m,'home')+.14*f(m,'rest')-.10*f(m,'travel')+.18*f(m,'efficiency')+.14*f(m,'form');
 const matchupSignal=.18*f(m,'matchup')+.16*f(m,'offenseDefense')+.14*f(m,'trenches')+.12*f(m,'shotQuality')+.12*f(m,'xg');
 const playerSignal=.20*f(m,'injury')+.18*f(m,'usage')+.18*f(m,'quarterback')+.18*f(m,'starter')+.16*f(m,'goalie')+.10*f(m,'lineup');
 const environmentSignal=.18*f(m,'weather')+.15*f(m,'park')+.12*f(m,'surface')+.10*f(m,'venue')-.10*f(m,'travel');
 const regimeSignal=(m.modelProb-m.marketProb)*2.2;
 const historicalSignal=.16*f(m,'form')+.12*f(m,'experience')+.12*f(m,'headToHead')+.10*f(m,'recentForm');

 const baseVotes:{name:string;prob:number;baseWeight:number}[]=[
  {name:'Market No-Vig',prob:clamp(m.marketProb),baseWeight:.10},
  {name:'Sport Engine',prob:sport.adjustedProbability,baseWeight:.18},
  {name:'Elo/Power',prob:shift(m.modelProb,powerSignal*.35),baseWeight:.10},
  {name:'Bayesian',prob:clamp(m.marketProb*(1-confidence*.45)+m.modelProb*(confidence*.45)),baseWeight:.11},
  {name:'Scenario Simulation',prob:shift((m.modelProb+sport.adjustedProbability)/2,(powerSignal+matchupSignal+playerSignal)*.10),baseWeight:.15},
  {name:'Matchup',prob:shift(m.modelProb,matchupSignal*.38),baseWeight:.10},
  {name:'Player/Usage',prob:shift(m.modelProb,playerSignal*.34),baseWeight:.10},
  {name:'Environment',prob:shift(m.modelProb,environmentSignal*.28),baseWeight:.06},
  {name:'Line Regime',prob:shift(m.marketProb,regimeSignal*.22),baseWeight:.05},
  {name:'Historical Analog',prob:shift(m.modelProb,historicalSignal*.30),baseWeight:.05}
 ];

 const votes:Vote[]=baseVotes.map(v=>{
  const lm=learnedMultiplier(learnedWeights,v.name,m.sport,m.market);
  return {...v,learnedMultiplier:lm,weight:v.baseWeight*lm};
 });
 const w=votes.reduce((s,v)=>s+v.weight,0);
 const ensemble=votes.reduce((s,v)=>s+v.prob*v.weight,0)/Math.max(.0001,w);
 const mean=votes.reduce((s,v)=>s+v.prob,0)/votes.length;
 const dispersion=Math.sqrt(votes.reduce((s,v)=>s+(v.prob-mean)**2,0)/votes.length);
 const agreement=Math.max(0,Math.min(1,1-dispersion/.12));
 return {votes,ensemble,dispersion,agreement,sport};
}
