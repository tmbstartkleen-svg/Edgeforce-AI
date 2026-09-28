export type CalibrationPoint={predicted:number;outcome:0|1};
export type CalibrationSummary={sampleSize:number;brierScore:number;logLoss:number;calibrationError:number};

export function summarizeCalibration(points:CalibrationPoint[]):CalibrationSummary{
 if(!points.length)return {sampleSize:0,brierScore:0,logLoss:0,calibrationError:0};
 let brier=0,log=0;
 const buckets=new Map<number,{n:number,sumPred:number,sumOutcome:number}>();
 for(const p of points){
  const q=Math.max(.001,Math.min(.999,p.predicted));
  brier+=(q-p.outcome)**2;
  log+=-(p.outcome*Math.log(q)+(1-p.outcome)*Math.log(1-q));
  const k=Math.min(9,Math.floor(q*10));
  const b=buckets.get(k)||{n:0,sumPred:0,sumOutcome:0};
  b.n++;b.sumPred+=q;b.sumOutcome+=p.outcome;buckets.set(k,b);
 }
 let ece=0;
 for(const b of buckets.values()) ece+=(b.n/points.length)*Math.abs(b.sumPred/b.n-b.sumOutcome/b.n);
 return {sampleSize:points.length,brierScore:brier/points.length,logLoss:log/points.length,calibrationError:ece};
}
