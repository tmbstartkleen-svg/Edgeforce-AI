import {championDriftDecision,championLiveMetrics} from '@/lib/mlChampionDrift';

export const dynamic='force-dynamic';

export async function GET(){
 const healthyRows=[
  {probability:.72,outcome:1,marketBaselineProbability:.66,settledAt:'2026-01-01'},
  {probability:.61,outcome:1,marketBaselineProbability:.56,settledAt:'2026-01-02'},
  {probability:.35,outcome:0,marketBaselineProbability:.40,settledAt:'2026-01-03'},
  {probability:.42,outcome:0,marketBaselineProbability:.46,settledAt:'2026-01-04'}
 ];
 const metrics=championLiveMetrics(healthyRows,.20);
 const insufficient=championDriftDecision({sampleSize:10,liveBrierSkillScore:.05,brierDegradation:.01,liveCalibrationError:.05,minSample:30});
 const firstCritical=championDriftDecision({sampleSize:50,liveBrierSkillScore:-.10,brierDegradation:.07,liveCalibrationError:.18,previousCriticalRuns:0,minSample:30});
 const repeatedCritical=championDriftDecision({sampleSize:50,liveBrierSkillScore:-.10,brierDegradation:.07,liveCalibrationError:.18,previousCriticalRuns:1,minSample:30});
 const watch=championDriftDecision({sampleSize:50,liveBrierSkillScore:-.01,brierDegradation:.035,liveCalibrationError:.12,previousCriticalRuns:0,minSample:30});
 const assertions={
  metricsFinite:Object.values(metrics).every(v=>Number.isFinite(v)),
  insufficientHeld:insufficient.state==='INSUFFICIENT'&&insufficient.action==='NONE',
  firstCriticalConfirms:firstCritical.state==='CRITICAL'&&firstCritical.action==='NONE',
  repeatedCriticalQuarantines:repeatedCritical.state==='CRITICAL'&&repeatedCritical.action==='QUARANTINE',
  watchDoesNotQuarantine:watch.state==='WATCH'&&watch.action==='NONE'
 };
 const ok=Object.values(assertions).every(Boolean);
 return Response.json({ok,build:'V59',assertions,metrics,insufficient,firstCritical,repeatedCritical,watch},{status:ok?200:500,headers:{'Cache-Control':'no-store'}});
}
