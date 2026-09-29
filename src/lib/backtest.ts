import {ev} from './math';

export type HistoricalPrediction={
  occurredAt:string;
  sport:string;
  marketKey:string;
  modelName:string;
  predicted:number;
  odds:number;
  outcome:0|1;
  closingOdds?:number;
};

export type BacktestSummary={
  sampleSize:number;
  hitRate:number;
  brierScore:number;
  logLoss:number;
  roi:number;
  avgEv:number;
  avgClv:number;
  maxDrawdown:number;
};

const decimal=(odds:number)=>odds>0?1+odds/100:1+100/Math.abs(odds);
const implied=(odds:number)=>1/decimal(odds);

export function summarizeBacktest(rows:HistoricalPrediction[]):BacktestSummary{
  if(!rows.length)return {sampleSize:0,hitRate:0,brierScore:0,logLoss:0,roi:0,avgEv:0,avgClv:0,maxDrawdown:0};
  let wins=0,brier=0,logLoss=0,pnl=0,avgEv=0,clvSum=0,clvN=0,equity=0,peak=0,maxDrawdown=0;
  for(const r of rows){
    const p=Math.max(.001,Math.min(.999,r.predicted));
    wins+=r.outcome;
    brier+=(p-r.outcome)**2;
    logLoss+=-(r.outcome*Math.log(p)+(1-r.outcome)*Math.log(1-p));
    avgEv+=ev(p,r.odds);
    const unitPnl=r.outcome?(decimal(r.odds)-1):-1;
    pnl+=unitPnl;
    equity+=unitPnl;
    peak=Math.max(peak,equity);
    maxDrawdown=Math.max(maxDrawdown,peak-equity);
    if(typeof r.closingOdds==='number'){
      clvSum+=implied(r.closingOdds)-implied(r.odds);
      clvN++;
    }
  }
  return {
    sampleSize:rows.length,
    hitRate:wins/rows.length,
    brierScore:brier/rows.length,
    logLoss:logLoss/rows.length,
    roi:pnl/rows.length,
    avgEv:avgEv/rows.length,
    avgClv:clvN?clvSum/clvN:0,
    maxDrawdown
  };
}

export function walkForward(rows:HistoricalPrediction[],trainSize:number,testSize:number){
  const sorted=[...rows].sort((a,b)=>new Date(a.occurredAt).getTime()-new Date(b.occurredAt).getTime());
  const folds=[];
  for(let start=0;start+trainSize+testSize<=sorted.length;start+=testSize){
    const train=sorted.slice(start,start+trainSize);
    const test=sorted.slice(start+trainSize,start+trainSize+testSize);
    folds.push({train:summarizeBacktest(train),test:summarizeBacktest(test),trainStart:train[0]?.occurredAt,trainEnd:train.at(-1)?.occurredAt,testStart:test[0]?.occurredAt,testEnd:test.at(-1)?.occurredAt});
  }
  return folds;
}
