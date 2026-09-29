import {impliedProbability} from './math';

export function clvFromOdds(offered:number,closing:number){
 return impliedProbability(closing)-impliedProbability(offered);
}

export function summarizeClv(rows:{offeredOdds:number;closingOdds:number}[]){
 if(!rows.length)return {sampleSize:0,avgClv:0,positiveRate:0,best:0,worst:0};
 const values=rows.map(r=>clvFromOdds(r.offeredOdds,r.closingOdds));
 return {
  sampleSize:values.length,
  avgClv:values.reduce((a,b)=>a+b,0)/values.length,
  positiveRate:values.filter(v=>v>0).length/values.length,
  best:Math.max(...values),
  worst:Math.min(...values)
 };
}
