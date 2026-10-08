import type {HistoricalPrediction} from './backtest';
import {settlementLearningFromFeatures} from './settlementLearning';

export type ForecastReliabilityBand={
 label:string;
 min:number;
 max:number;
 sampleSize:number;
 effectiveSampleSize:number;
 meanForecast:number;
 observedRate:number;
 calibrationGap:number;
 direction:'OVERCONFIDENT'|'UNDERCONFIDENT'|'CALIBRATED';
};

export type ForecastResearchMetrics={
 sampleSize:number;
 effectiveSampleSize:number;
 brierScore:number;
 logLoss:number;
 calibrationError:number;
 sharpness:number;
 meanForecast:number;
 observedRate:number;
};

export type ForecastReplay={
 prior:ForecastResearchMetrics;
 recent:ForecastResearchMetrics;
 brierDelta:number;
 logLossDelta:number;
 calibrationDelta:number;
 sharpnessDelta:number;
 state:'STABLE'|'WATCH'|'DRIFTING'|'INSUFFICIENT';
};

export type ForecastModelScorecard={
 modelName:string;
 sport:string;
 marketKey:string;
 sampleSize:number;
 effectiveSampleSize:number;
 brierScore:number;
 logLoss:number;
 calibrationError:number;
 sharpness:number;
 recentEffectiveSampleSize:number;
 priorEffectiveSampleSize:number;
 brierDelta:number;
 calibrationDelta:number;
 driftState:ForecastReplay['state'];
 researchGrade:'ROBUST'|'QUALIFIED'|'WATCH'|'INSUFFICIENT';
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const safeProbability=(n:number)=>clamp(Number(n),.001,.999);

function weight(row:HistoricalPrediction){
 return Math.max(0,settlementLearningFromFeatures(row.features).evidenceWeight);
}

export function forecastResearchMetrics(rows:HistoricalPrediction[]):ForecastResearchMetrics{
 if(!rows.length)return {
  sampleSize:0,effectiveSampleSize:0,brierScore:0,logLoss:0,
  calibrationError:0,sharpness:0,meanForecast:0,observedRate:0
 };
 let totalWeight=0;
 let brier=0;
 let logLoss=0;
 let forecast=0;
 let observed=0;
 let sharpness=0;
 for(const row of rows){
  const w=weight(row);
  const p=safeProbability(row.predicted);
  totalWeight+=w;
  brier+=(p-row.outcome)**2*w;
  logLoss+=-(row.outcome*Math.log(p)+(1-row.outcome)*Math.log(1-p))*w;
  forecast+=p*w;
  observed+=row.outcome*w;
  sharpness+=Math.abs(p-.5)*2*w;
 }
 const denominator=Math.max(.0001,totalWeight);
 const meanForecast=forecast/denominator;
 const observedRate=observed/denominator;
 return {
  sampleSize:rows.length,
  effectiveSampleSize:totalWeight,
  brierScore:brier/denominator,
  logLoss:logLoss/denominator,
  calibrationError:Math.abs(meanForecast-observedRate),
  sharpness:sharpness/denominator,
  meanForecast,
  observedRate
 };
}

export function forecastReliabilityBands(rows:HistoricalPrediction[],bucketCount=10):ForecastReliabilityBand[]{
 const buckets=Array.from({length:bucketCount},(_,bucket)=>({
  bucket,
  min:bucket/bucketCount,
  max:(bucket+1)/bucketCount,
  rows:[] as HistoricalPrediction[]
 }));
 for(const row of rows){
  const p=clamp(row.predicted,0,.999999);
  buckets[Math.min(bucketCount-1,Math.floor(p*bucketCount))].rows.push(row);
 }
 return buckets.map(bucket=>{
  let effectiveSampleSize=0;
  let forecast=0;
  let observed=0;
  for(const row of bucket.rows){
   const w=weight(row);
   effectiveSampleSize+=w;
   forecast+=safeProbability(row.predicted)*w;
   observed+=row.outcome*w;
  }
  const denominator=Math.max(.0001,effectiveSampleSize);
  const meanForecast=bucket.rows.length?forecast/denominator:0;
  const observedRate=bucket.rows.length?observed/denominator:0;
  const calibrationGap=meanForecast-observedRate;
  const direction:ForecastReliabilityBand['direction']=
   Math.abs(calibrationGap)<.025?'CALIBRATED':calibrationGap>0?'OVERCONFIDENT':'UNDERCONFIDENT';
  return {
   label:`${Math.round(bucket.min*100)}–${Math.round(bucket.max*100)}%`,
   min:bucket.min,
   max:bucket.max,
   sampleSize:bucket.rows.length,
   effectiveSampleSize,
   meanForecast,
   observedRate,
   calibrationGap,
   direction
  };
 });
}

export function forecastCalibrationError(rows:HistoricalPrediction[],bucketCount=10){
 const bands=forecastReliabilityBands(rows,bucketCount).filter(x=>x.effectiveSampleSize>0);
 const total=bands.reduce((sum,band)=>sum+band.effectiveSampleSize,0);
 if(!total)return 0;
 return bands.reduce((sum,band)=>sum+Math.abs(band.calibrationGap)*band.effectiveSampleSize,0)/total;
}

export function forecastTemporalReplay(rows:HistoricalPrediction[],recentFraction=.25):ForecastReplay{
 const sorted=[...rows].sort((a,b)=>new Date(a.occurredAt).getTime()-new Date(b.occurredAt).getTime());
 if(sorted.length<8){
  const empty=forecastResearchMetrics([]);
  return {prior:empty,recent:empty,brierDelta:0,logLossDelta:0,calibrationDelta:0,sharpnessDelta:0,state:'INSUFFICIENT'};
 }
 const recentSize=Math.max(2,Math.floor(sorted.length*clamp(recentFraction,.1,.5)));
 const priorRows=sorted.slice(0,Math.max(1,sorted.length-recentSize));
 const recentRows=sorted.slice(sorted.length-recentSize);
 const prior={...forecastResearchMetrics(priorRows),calibrationError:forecastCalibrationError(priorRows)};
 const recent={...forecastResearchMetrics(recentRows),calibrationError:forecastCalibrationError(recentRows)};
 const brierDelta=recent.brierScore-prior.brierScore;
 const logLossDelta=recent.logLoss-prior.logLoss;
 const calibrationDelta=recent.calibrationError-prior.calibrationError;
 const sharpnessDelta=recent.sharpness-prior.sharpness;
 let state:ForecastReplay['state']='STABLE';
 if(prior.effectiveSampleSize<5||recent.effectiveSampleSize<3)state='INSUFFICIENT';
 else if(brierDelta>.06||logLossDelta>.12||calibrationDelta>.06)state='DRIFTING';
 else if(brierDelta>.025||logLossDelta>.05||calibrationDelta>.03)state='WATCH';
 return {prior,recent,brierDelta,logLossDelta,calibrationDelta,sharpnessDelta,state};
}

function researchGrade(metrics:ForecastResearchMetrics,replay:ForecastReplay):ForecastModelScorecard['researchGrade']{
 if(metrics.effectiveSampleSize<25||replay.state==='INSUFFICIENT')return 'INSUFFICIENT';
 if(replay.state==='DRIFTING'||metrics.calibrationError>.10||metrics.brierScore>.32)return 'WATCH';
 if(metrics.effectiveSampleSize>=100&&metrics.calibrationError<=.05&&metrics.brierScore<=.25)return 'ROBUST';
 return 'QUALIFIED';
}

export function forecastModelScorecards(rows:HistoricalPrediction[]):ForecastModelScorecard[]{
 const groups=new Map<string,HistoricalPrediction[]>();
 for(const row of rows){
  const key=[row.modelName,row.sport,row.marketKey].join('|');
  groups.set(key,[...(groups.get(key)||[]),row]);
 }
 return [...groups.entries()].map(([key,group])=>{
  const [modelName,sport,marketKey]=key.split('|');
  const base=forecastResearchMetrics(group);
  const calibrationError=forecastCalibrationError(group);
  const replay=forecastTemporalReplay(group);
  const metrics={...base,calibrationError};
  return {
   modelName,sport,marketKey,
   sampleSize:group.length,
   effectiveSampleSize:metrics.effectiveSampleSize,
   brierScore:metrics.brierScore,
   logLoss:metrics.logLoss,
   calibrationError,
   sharpness:metrics.sharpness,
   recentEffectiveSampleSize:replay.recent.effectiveSampleSize,
   priorEffectiveSampleSize:replay.prior.effectiveSampleSize,
   brierDelta:replay.brierDelta,
   calibrationDelta:replay.calibrationDelta,
   driftState:replay.state,
   researchGrade:researchGrade(metrics,replay)
  };
 }).sort((a,b)=>{
  const grade=(x:ForecastModelScorecard['researchGrade'])=>x==='ROBUST'?0:x==='QUALIFIED'?1:x==='WATCH'?2:3;
  return grade(a.researchGrade)-grade(b.researchGrade)
   ||a.brierScore-b.brierScore
   ||a.calibrationError-b.calibrationError
   ||b.effectiveSampleSize-a.effectiveSampleSize;
 });
}

function fnv1a(input:string){
 let hash=0x811c9dc5;
 for(let i=0;i<input.length;i++){
  hash^=input.charCodeAt(i);
  hash=Math.imul(hash,0x01000193)>>>0;
 }
 return hash.toString(16).padStart(8,'0');
}

export function forecastResearchFingerprint(rows:HistoricalPrediction[]){
 const canonical=[...rows]
  .sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)
   ||a.modelName.localeCompare(b.modelName)
   ||a.sport.localeCompare(b.sport)
   ||a.marketKey.localeCompare(b.marketKey)
   ||String(a.selectionKey||'').localeCompare(String(b.selectionKey||'')))
  .map(row=>[
   row.occurredAt,row.modelName,row.modelVersion||'',row.sport,row.marketKey,row.selectionKey||'',
   safeProbability(row.predicted).toFixed(8),row.outcome,
   weight(row).toFixed(4)
  ].join('|'))
  .join('\n');
 return `frl-${fnv1a(canonical)}-${rows.length}`;
}

export function buildForecastResearchReport(rows:HistoricalPrediction[]){
 const summaryBase=forecastResearchMetrics(rows);
 const summary={...summaryBase,calibrationError:forecastCalibrationError(rows)};
 const replay=forecastTemporalReplay(rows);
 const reliability=forecastReliabilityBands(rows);
 const scorecards=forecastModelScorecards(rows);
 const grades=scorecards.reduce((acc,row)=>{
  acc[row.researchGrade]=(acc[row.researchGrade]||0)+1;
  return acc;
 },{} as Record<string,number>);
 return {
  schemaVersion:'v155-forecast-research-lab-1',
  generatedAt:new Date().toISOString(),
  researchOnly:true,
  fingerprint:forecastResearchFingerprint(rows),
  summary,
  replay,
  reliability,
  scorecards,
  grades
 };
}
