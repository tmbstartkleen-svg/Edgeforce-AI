import type {BacktestSummary} from './backtest';

export type ModelScore={modelName:string;summary:BacktestSummary};

export function scoreModel(s:BacktestSummary){
  if(s.sampleSize<25)return 0.01;
  const calibration=Math.max(0,1-s.brierScore/.25);
  const log=Math.max(0,1-s.logLoss/.7);
  const clv=Math.max(-.25,Math.min(.25,s.avgClv*4));
  const roi=Math.max(-.25,Math.min(.25,s.roi));
  const drawdownPenalty=Math.min(.3,s.maxDrawdown/Math.max(10,s.sampleSize));
  return Math.max(.01,.45*calibration+.25*log+.15*(.5+clv)+.15*(.5+roi)-drawdownPenalty);
}

export function normalizedWeights(models:ModelScore[]){
  const scored=models.map(m=>({...m,score:scoreModel(m.summary)}));
  const total=scored.reduce((s,m)=>s+m.score,0)||1;
  return scored.map(m=>({modelName:m.modelName,weight:m.score/total,score:m.score,sampleSize:m.summary.sampleSize}));
}
