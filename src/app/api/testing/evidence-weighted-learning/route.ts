import {summarizeBacktest,type HistoricalPrediction} from '@/lib/backtest';
import {calibrationSummary} from '@/lib/modelCalibration';
import {rollingModelPerformance} from '@/lib/modelPerformance';
import {settlementLearningPolicy} from '@/lib/settlementLearning';

export const dynamic='force-dynamic';

export async function GET(){
 const now=Date.now();
 const provider=settlementLearningPolicy({evidenceClass:'PROVIDER_NATIVE',confidence:'PROVIDER_NATIVE'});
 const medium=settlementLearningPolicy({evidenceClass:'CORROBORATED_SCORE',confidence:'MEDIUM'});
 const rows:HistoricalPrediction[]=[
  {
   occurredAt:new Date(now-60000).toISOString(),
   sport:'TEST',marketKey:'Moneyline',modelName:'Weighted Model',
   predicted:.90,odds:-110,outcome:1,closingOdds:-115,
   features:{settlementLearning:provider}
  },
  {
   occurredAt:new Date(now).toISOString(),
   sport:'TEST',marketKey:'Moneyline',modelName:'Weighted Model',
   predicted:.90,odds:-110,outcome:0,closingOdds:-105,
   features:{settlementLearning:medium}
  }
 ];
 const backtest=summarizeBacktest(rows);
 const calibration=calibrationSummary(rows);
 const performance=rollingModelPerformance(rows,new Date(now))[0];
 const expectedBrier=(.01*1+.81*.75)/1.75;
 const assertions={
  effectiveSampleSize:Math.abs(backtest.effectiveSampleSize-1.75)<1e-9,
  weightedBrier:Math.abs(backtest.brierScore-expectedBrier)<1e-9,
  weightedBrierDiffersFromUnweighted:Math.abs(backtest.brierScore-.41)>.01,
  calibrationWeighted:Math.abs(calibration.effectiveSampleSize-1.75)<1e-9,
  performanceWeighted:Math.abs((performance?.effectiveSampleSize??0)-1.75)<1e-9,
  mediumWeightApplied:medium.evidenceWeight===.75
 };
 return Response.json({
  ok:Object.values(assertions).every(Boolean),
  build:'V153',
  schemaVersion:'v153-evidence-weighted-learning-1',
  assertions,
  weights:{provider:provider.evidenceWeight,medium:medium.evidenceWeight},
  backtest,
  calibration:{sampleSize:calibration.sampleSize,effectiveSampleSize:calibration.effectiveSampleSize,meanAbsoluteCalibrationError:calibration.meanAbsoluteCalibrationError},
  performance
 },{headers:{'Cache-Control':'no-store'}});
}
