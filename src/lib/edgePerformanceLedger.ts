import {calculateEdgeValue,breakEvenProbability} from './edgeValue';
export type SettledEdgePick={
 id:string; sport:string; marketKey:string; modelId:string; predictionCreatedAt:string;
 eventStartedAt:string; quotedOdds:number; predictedProbability:number;
 result:'WIN'|'LOSS'|'PUSH'|'VOID'|'PENDING';
 settledAt?:string; closingOdds?:number;
 settlementVerified:boolean; closingQuoteVerified:boolean;
};
export type EdgePerformance={
 eligibleCount:number;excludedCount:number;pendingCount:number;
 wins:number;losses:number;winRate:number|null;meanPredictedProbability:number|null;
 realizedRoiPercent:number|null;projectedRoiPercent:number|null;
 brierScore:number|null;meanEdgePp:number|null;meanClosingLineValuePp:number|null;
 closingLineSampleCount:number;sampleSufficient:boolean;
};
export function summarizeEdgePerformance(rows:SettledEdgePick[],minSample=200):EdgePerformance{
 if(!Number.isInteger(minSample)||minSample<1)throw new RangeError('Invalid minimum sample');
 const eligible:SettledEdgePick[]=[];
 let excludedCount=0,pendingCount=0;
 for(const row of rows){
  if(row.result==='PENDING'){pendingCount++;continue;}
  const placed=Date.parse(row.predictionCreatedAt),started=Date.parse(row.eventStartedAt),settled=Date.parse(row.settledAt||'');
  try{calculateEdgeValue(row.quotedOdds,row.predictedProbability);}catch{excludedCount++;continue;}
  if(!row.id.trim()||!row.modelId.trim()||!row.marketKey.trim()||
   !row.settlementVerified||!Number.isFinite(placed)||!Number.isFinite(started)||
   !Number.isFinite(settled)||placed>=started||settled<started||
   (row.result!=='WIN'&&row.result!=='LOSS')){
   excludedCount++;continue;
  }
  eligible.push(row);
 }
 const n=eligible.length;
 const mean=(f:(row:SettledEdgePick)=>number)=>n?eligible.reduce((s,r)=>s+f(r),0)/n:null;
 const wins=eligible.filter(r=>r.result==='WIN').length;
 const projected=mean(r=>calculateEdgeValue(r.quotedOdds,r.predictedProbability).expectedRoiPercent);
 const realized=mean(r=>r.result==='WIN'?calculateEdgeValue(r.quotedOdds,r.predictedProbability).profitPerDollarWon*100:-100);
 const clv=eligible.filter(r=>{
  if(!r.closingQuoteVerified||r.closingOdds===undefined)return false;
  try{breakEvenProbability(r.closingOdds);return true;}catch{return false;}
 });
 return {
  eligibleCount:n,excludedCount,pendingCount,wins,losses:n-wins,
  winRate:n?wins/n:null,
  meanPredictedProbability:mean(r=>r.predictedProbability),
  realizedRoiPercent:realized,
  projectedRoiPercent:projected,
  brierScore:mean(r=>(r.predictedProbability-(r.result==='WIN'?1:0))**2),
  meanEdgePp:mean(r=>calculateEdgeValue(r.quotedOdds,r.predictedProbability).probabilityEdgePp),
  meanClosingLineValuePp:clv.length?clv.reduce((sum,r)=>sum+(breakEvenProbability(r.closingOdds!)-breakEvenProbability(r.quotedOdds))*100,0)/clv.length:null,
  closingLineSampleCount:clv.length,
  sampleSufficient:n>=minSample
 };
}
