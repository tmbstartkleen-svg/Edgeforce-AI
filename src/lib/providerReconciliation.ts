import {impliedProbability} from './math';

export type ProviderPrice={
 provider:string;
 odds:number;
 pulledAt:string|Date;
 confidence:number;
};

export function reconcileProviderPrices(rows:ProviderPrice[]){
 const valid=rows.filter(r=>Number.isFinite(r.odds)&&r.confidence>0);
 if(!valid.length)return {probability:.5,odds:0,agreement:0,dispersion:1,providers:0};
 const probs=valid.map(r=>impliedProbability(r.odds));
 const weights=valid.map(r=>Math.max(.01,r.confidence));
 const total=weights.reduce((a,b)=>a+b,0);
 const probability=probs.reduce((s,p,i)=>s+p*weights[i],0)/total;
 const variance=probs.reduce((s,p,i)=>s+weights[i]*(p-probability)**2,0)/total;
 const dispersion=Math.sqrt(variance);
 const agreement=Math.max(0,Math.min(1,1-dispersion/.12));
 const decimal=1/probability;
 const odds=decimal>=2?Math.round((decimal-1)*100):Math.round(-100/(decimal-1));
 return {probability,odds,agreement,dispersion,providers:valid.length};
}
