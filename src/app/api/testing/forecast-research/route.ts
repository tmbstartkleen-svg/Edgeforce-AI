import {buildForecastResearchReport,type HistoricalPrediction} from '@/lib/forecastResearchLab';

export const dynamic='force-dynamic';

export async function GET(){
 const now=Date.now();
 const rows:HistoricalPrediction[]=[];
 for(let i=0;i<120;i++){
  const strong=i<90;
  const predicted=strong?(i%2===0?.72:.28):(i%2===0?.66:.34);
  const outcome=strong?(i%2===0?1:0):(i%3===0?1:0);
  rows.push({
   occurredAt:new Date(now-(120-i)*3600000).toISOString(),
   sport:'TEST',
   marketKey:'Outcome',
   modelName:strong?'Stable Research Model':'Drift Watch Model',
   modelVersion:'test',
   selectionKey:'fixture-'+i,
   predicted,
   odds:0,
   outcome:outcome as 0|1,
   features:{
    settlementLearning:{
     schemaVersion:'v152-settlement-learning-1',
     evidenceClass:'PROVIDER_NATIVE',
     confidence:'PROVIDER_NATIVE',
     trainingEligible:true,
     evidenceWeight:1,
     legacy:false,
     reason:'fixture'
    }
   }
  });
 }
 const report=buildForecastResearchReport(rows);
 const stable=report.scorecards.find(x=>x.modelName==='Stable Research Model');
 const watch=report.scorecards.find(x=>x.modelName==='Drift Watch Model');
 const assertions={
  researchOnly:report.researchOnly===true,
  fingerprintStable:report.fingerprint.startsWith('frl-')&&report.fingerprint.endsWith('-120'),
  reliabilityPresent:report.reliability.length===10,
  stableScored:Boolean(stable&&stable.effectiveSampleSize===90),
  watchScored:Boolean(watch&&watch.effectiveSampleSize===30),
  noExecutionOutput:!('stake' in report)&&!('order' in report)&&!('wager' in report)
 };
 return Response.json({
  ok:Object.values(assertions).every(Boolean),
  build:'V155',
  schemaVersion:'v155-forecast-research-lab-1',
  assertions,
  report
 },{headers:{'Cache-Control':'no-store'}});
}
