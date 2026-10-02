import type {Market} from './types';
import {sportModel} from './sportModels';

export type Vote={name:string;prob:number;weight:number};
const clamp=(x:number,min=.01,max=.99)=>Math.max(min,Math.min(max,x));

function normalCdf(x:number){
 const t=1/(1+.2316419*Math.abs(x));
 const d=.3989423*Math.exp(-x*x/2);
 let p=1-d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
 if(x<0)p=1-p;
 return p;
}

function projectionProbability(m:Market){
 if(typeof m.projectionMean!=='number'||typeof m.projectionStdDev!=='number'||typeof m.point!=='number')return null;
 const sd=Math.max(.2,m.projectionStdDev);
 const z=(m.point-m.projectionMean)/sd;
 const lower=normalCdf(z);
 const selection=m.selection.toLowerCase();
 if(selection.includes('under'))return clamp(lower);
 if(selection.includes('over'))return clamp(1-lower);
 return null;
}

export function modelCouncil(m:Market){
 const sport=sportModel(m,m.sportFeatures||{});
 const marketFair=clamp(m.noVigProb??m.marketProb);
 const projection=projectionProbability(m);
 const votes:Vote[]=[
  {name:'Market No-Vig',prob:marketFair,weight:.38},
  {name:'Sport Context',prob:clamp(sport.adjustedProbability),weight:.34}
 ];
 if(projection!==null)votes.push({name:'Player Projection',prob:projection,weight:.20});
 if(typeof m.predictionProb==='number'){
  const liquidityScale=m.predictionLiquidity===undefined?1:Math.max(.25,Math.min(1,m.predictionLiquidity/25000));
  votes.push({name:'Prediction Market',prob:clamp(m.predictionProb),weight:.08*liquidityScale});
 }
 const dataQuality=Math.max(.35,Math.min(1,m.dataQuality??1));
 const w=votes.reduce((s,v)=>s+v.weight,0);
 const ensemble=clamp(votes.reduce((s,v)=>s+v.prob*v.weight,0)/Math.max(.0001,w));
 const mean=votes.reduce((s,v)=>s+v.prob,0)/votes.length;
 const dispersion=Math.sqrt(votes.reduce((s,v)=>s+(v.prob-mean)**2,0)/votes.length);
 const agreement=Math.max(0,Math.min(1,(1-dispersion/.14)*dataQuality));
 return {votes,ensemble,dispersion,agreement,sport,projection};
}
