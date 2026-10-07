import type {HistoricalPrediction} from './backtest';
import {settlementLearningFromFeatures} from './settlementLearning';

export type CalibrationBucket={bucket:number;min:number;max:number;sampleSize:number;effectiveSampleSize:number;predicted:number;actual:number;error:number;direction:'OVERCONFIDENT'|'UNDERCONFIDENT'|'CALIBRATED'};

export function calibrationBuckets(rows:HistoricalPrediction[],bucketCount=10):CalibrationBucket[]{
 const buckets=Array.from({length:bucketCount},(_,i)=>({bucket:i,min:i/bucketCount,max:(i+1)/bucketCount,rows:[] as HistoricalPrediction[]}));
 for(const row of rows){const p=Math.max(0,Math.min(.999999,row.predicted));buckets[Math.min(bucketCount-1,Math.floor(p*bucketCount))].rows.push(row);}
 return buckets.map(b=>{
  const sampleSize=b.rows.length;
  const effectiveSampleSize=b.rows.reduce((sum,row)=>sum+settlementLearningFromFeatures(row.features).evidenceWeight,0);
  const denominator=Math.max(.0001,effectiveSampleSize);
  const predicted=sampleSize?b.rows.reduce((sum,row)=>sum+row.predicted*settlementLearningFromFeatures(row.features).evidenceWeight,0)/denominator:0;
  const actual=sampleSize?b.rows.reduce((sum,row)=>sum+row.outcome*settlementLearningFromFeatures(row.features).evidenceWeight,0)/denominator:0;
  const error=predicted-actual;
  const direction=Math.abs(error)<.025?'CALIBRATED':error>0?'OVERCONFIDENT':'UNDERCONFIDENT';
  return {bucket:b.bucket,min:b.min,max:b.max,sampleSize,effectiveSampleSize,predicted,actual,error,direction};
 });
}

export function calibrationSummary(rows:HistoricalPrediction[]){
 const buckets=calibrationBuckets(rows);
 const populated=buckets.filter(b=>b.sampleSize>0);
 const effectiveSampleSize=populated.reduce((s,b)=>s+b.effectiveSampleSize,0);
 const denominator=Math.max(.0001,effectiveSampleSize);
 const mae=effectiveSampleSize?populated.reduce((s,b)=>s+Math.abs(b.error)*b.effectiveSampleSize,0)/denominator:0;
 const over=populated.filter(b=>b.direction==='OVERCONFIDENT').reduce((s,b)=>s+b.sampleSize,0);
 const under=populated.filter(b=>b.direction==='UNDERCONFIDENT').reduce((s,b)=>s+b.sampleSize,0);
 return {sampleSize:rows.length,effectiveSampleSize,meanAbsoluteCalibrationError:mae,overconfidentSamples:over,underconfidentSamples:under,buckets};
}
