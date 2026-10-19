import {calculateEdgeValue} from './edgeValue';

/** Display-only price math. No source or model verification is implied. */
export function boardValueMetrics(americanOdds:number,modelProbability:number){
 try{
  const value=calculateEdgeValue(americanOdds,modelProbability);
  return {breakEvenProbability:value.breakEvenProbability,
   probabilityEdgePp:value.probabilityEdgePp,
   expectedRoiPercent:value.expectedRoiPercent,verified:false};
 }catch{return null;}
}
