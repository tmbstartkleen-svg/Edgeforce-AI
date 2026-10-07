import type {HistoricalPrediction} from './backtest';
import {summarizeBacktest} from './backtest';
import {calibrationSummary} from './modelCalibration';
import {confidenceDecay} from './confidenceDecay';
import {settlementLearningFromFeatures} from './settlementLearning';

export type RollingModelPerformance={modelName:string;sport:string;marketKey:string;sampleSize:number;effectiveSampleSize:number;brierScore:number;logLoss:number;roi:number;avgClv:number;calibrationError:number;decayedScore:number;confidenceLabel:'HIGH'|'MEDIUM'|'LOW'|'INSUFFICIENT'};

export function rollingModelPerformance(rows:HistoricalPrediction[],now=new Date()):RollingModelPerformance[]{
 const groups=new Map<string,HistoricalPrediction[]>();
 for(const row of rows){const key=[row.modelName,row.sport,row.marketKey].join('|');const arr=groups.get(key)||[];arr.push(row);groups.set(key,arr);}
 return [...groups.entries()].map(([key,group])=>{const [modelName,sport,marketKey]=key.split('|');const summary=summarizeBacktest(group);const calibration=calibrationSummary(group);const recent=group.reduce((acc,row)=>{const ageDays=Math.max(0,(now.getTime()-new Date(row.occurredAt).getTime())/86400000);const evidenceWeight=settlementLearningFromFeatures(row.features).evidenceWeight;const decay=confidenceDecay(ageDays)*evidenceWeight;const correctness=1-Math.abs(row.predicted-row.outcome);acc.weighted+=correctness*decay;acc.weight+=decay;return acc;},{weighted:0,weight:0});const decayedScore=recent.weight?recent.weighted/recent.weight:0;const confidenceLabel:RollingModelPerformance['confidenceLabel']=summary.effectiveSampleSize<25?'INSUFFICIENT':decayedScore>=.72&&calibration.meanAbsoluteCalibrationError<=.06?'HIGH':decayedScore>=.62?'MEDIUM':'LOW';return {modelName,sport,marketKey,sampleSize:summary.sampleSize,effectiveSampleSize:summary.effectiveSampleSize,brierScore:summary.brierScore,logLoss:summary.logLoss,roi:summary.roi,avgClv:summary.avgClv,calibrationError:calibration.meanAbsoluteCalibrationError,decayedScore,confidenceLabel};}).sort((a,b)=>b.decayedScore-a.decayedScore);
}
