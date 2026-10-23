/**
 * Historical probability calibration for settled binary outcomes only.
 * This module does not fetch sports data or represent paper forecasts as verified.
 */
export type SettledForecast={
 forecastId:string;eventId:string;marketKey:string;modelId:string;
 predictedAt:string;settledAt:string;probability:number;result:0|1;
};
export function evaluateCalibration(rows:SettledForecast[],asOf:string,minSamples=30){
 const now=Date.parse(asOf);
 if(!Number.isFinite(now)||!Number.isSafeInteger(minSamples)||minSamples<1||minSamples>100000)throw Error('INVALID_CALIBRATION_CONFIG');
 if(!Array.isArray(rows)||rows.length>100000)throw Error('INVALID_CALIBRATION_BATCH');
 const reasons:Record<string,number>={};const rejects=(reason:string)=>{reasons[reason]=(reasons[reason]||0)+1;};
 const accepted:SettledForecast[]=[];const seen=new Set<string>();
 for(const r of rows){
  if(!r||![r.forecastId,r.eventId,r.marketKey,r.modelId].every(v=>typeof v==='string'&&v.trim())){rejects('MISSING_IDENTITY');continue;}
  if(seen.has(r.forecastId)){rejects('DUPLICATE_FORECAST_ID');continue;}
  const predicted=Date.parse(r.predictedAt),settled=Date.parse(r.settledAt);
  if(!Number.isFinite(predicted)||!Number.isFinite(settled)||predicted>=settled||settled>now){rejects('INVALID_TIMELINE');continue;}
  if(!Number.isFinite(r.probability)||r.probability<=0||r.probability>=1||(r.result!==0&&r.result!==1)){rejects('INVALID_OUTCOME');continue;}
  seen.add(r.forecastId);
  accepted.push(r);
 }
 // Never pool different model versions into a single calibration certificate.
 const byModel=new Map<string,SettledForecast[]>();
 for(const r of accepted)byModel.set(r.modelId,[...(byModel.get(r.modelId)||[]),r]);
 const models=[...byModel].map(([modelId,data])=>{
  const n=data.length,meanProbability=data.reduce((s,r)=>s+r.probability,0)/n;
  const observedRate=data.reduce((s,r)=>s+r.result,0)/n;
  const brier=data.reduce((s,r)=>s+(r.probability-r.result)**2,0)/n;
  const logLoss=data.reduce((s,r)=>s-(r.result?Math.log(r.probability):Math.log1p(-r.probability)),0)/n;
  const bins=Array.from({length:10},(_,i)=>{const items=data.filter(r=>Math.min(9,Math.floor(r.probability*10))===i);
   return {rangeStart:i/10,rangeEnd:(i+1)/10,count:items.length,
    meanProbability:items.length?items.reduce((s,r)=>s+r.probability,0)/items.length:null,
    observedRate:items.length?items.reduce((s,r)=>s+r.result,0)/items.length:null};});
  const expectedCalibrationError=bins.reduce((sum,bin)=>sum+(bin.count/n)*Math.abs((bin.meanProbability??0)-(bin.observedRate??0)),0);
  // In-sample base rate is descriptive only, not a deployable holdout baseline.
  const inSampleBaseRateBrier=observedRate*(1-observedRate);
  return {modelId,count:n,brier,logLoss,meanProbability,observedRate,bins,expectedCalibrationError,inSampleBaseRateBrier,
   status:n>=minSamples?'REVIEW_REQUIRED' as const:'INSUFFICIENT_SAMPLE' as const,
   warning:'Retrospective descriptive scoring only; provenance, held-out independence, market availability and predictive calibration remain uncertified.'};
 }).sort((a,b)=>b.count-a.count||a.modelId.localeCompare(b.modelId));
 return {asOf:new Date(now).toISOString(),totalInput:rows.length,accepted:accepted.length,rejected:rows.length-accepted.length,
  rejectionReasons:reasons,minSamples,models,
  certified:false,warning:'No model is certified from caller-supplied settled results alone.'};
}
