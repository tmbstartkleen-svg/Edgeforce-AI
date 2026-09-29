import type {Scanned} from './scanner';
import {scoreDataQuality, type ProviderObservation} from './dataQuality';

export function applyQualityGate(rows:Scanned[],observations:Record<string,ProviderObservation[]>={}){
 return rows.map(row=>{
  const quality=scoreDataQuality(row,observations[row.id]||[]);
  const qualityPenalty=quality.score<.82?(1-quality.score)*.35:0;
  const adjustedEv=row.expectedValue-qualityPenalty;
  const grade=quality.suppress?'PASS':row.grade;
  return {...row,dataQuality:quality,qualityAdjustedEv:adjustedEv,grade};
 }).filter(x=>!x.dataQuality.suppress);
}
