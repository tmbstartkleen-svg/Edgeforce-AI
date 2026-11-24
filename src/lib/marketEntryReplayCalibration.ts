/**
 * Historical walk-forward checks for market-price path forecasts.
 * A simulation's predicted probability of touching a limit is NOT a fill
 * probability. Observed touches must be evaluated separately from fills.
 */
export type EntryReplayObservation={
 gameId:string;
 forecastCreatedAt:string;
 gameStartedAt:string;
 predictedTouchProbability:number;
 observedTouch:boolean;
 observedFill:boolean|null;
};
export type EntryReplayCalibration={
 status:'insufficient_evidence'|'invalid'|'ready';
 sampleSize:number;
 touchBrierScore:number|null;
 observedTouchRate:number|null;
 observedFillRate:number|null;
 calibrationBins:{lower:number;upper:number;count:number;predicted:number;observed:number}[];
 warning:string;
};
export function evaluateEntryReplay(observations:EntryReplayObservation[],minimumSample=100):EntryReplayCalibration{
 const warning='Retrospective calibration only. Historical touch or fill rates do not guarantee future limit-order execution.';
 const empty=(status:EntryReplayCalibration['status']):EntryReplayCalibration=>({status,sampleSize:Array.isArray(observations)?observations.length:0,touchBrierScore:null,observedTouchRate:null,observedFillRate:null,calibrationBins:[],warning});
 if(!Array.isArray(observations)||!Number.isInteger(minimumSample)||minimumSample<30||
 observations.some(o=>!o.gameId||!Number.isFinite(Date.parse(o.forecastCreatedAt))||
 !Number.isFinite(Date.parse(o.gameStartedAt))||Date.parse(o.forecastCreatedAt)>=Date.parse(o.gameStartedAt)||
 !Number.isFinite(o.predictedTouchProbability)||o.predictedTouchProbability<0||o.predictedTouchProbability>1||
 typeof o.observedTouch!=='boolean'||(o.observedFill!==null&&typeof o.observedFill!=='boolean')||
 (o.observedFill===true&&!o.observedTouch)))return empty('invalid');
 if(observations.length<minimumSample)return empty('insufficient_evidence');
 const n=observations.length;
 const touchBrierScore=observations.reduce((sum,o)=>sum+(o.predictedTouchProbability-Number(o.observedTouch))**2,0)/n;
 const observedTouchRate=observations.filter(o=>o.observedTouch).length/n;
 const fillKnown=observations.filter(o=>o.observedFill!==null);
 const observedFillRate=fillKnown.length?fillKnown.filter(o=>o.observedFill).length/fillKnown.length:null;
 const calibrationBins=Array.from({length:5},(_,i)=>{
  const lower=i/5,upper=(i+1)/5;
  const subset=observations.filter(o=>o.predictedTouchProbability>=lower&&(i===4?o.predictedTouchProbability<=upper:o.predictedTouchProbability<upper));
  return {lower,upper,count:subset.length,predicted:subset.length?subset.reduce((sum,o)=>sum+o.predictedTouchProbability,0)/subset.length:0,
   observed:subset.length?subset.filter(o=>o.observedTouch).length/subset.length:0};
 });
 return {status:'ready',sampleSize:n,touchBrierScore,observedTouchRate,observedFillRate,calibrationBins,warning};
}
