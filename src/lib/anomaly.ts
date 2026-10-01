import type {Scanned} from './scanner';

export type AnomalySignal={
  id:string;
  severity:'HIGH'|'MEDIUM'|'LOW';
  sport:string;
  selection:string;
  score:number;
  reason:string;
};

export function detectAnomalies(rows:Scanned[]):AnomalySignal[]{
  return rows.map(x=>{
    const simGap=x.simProbability-x.marketProb;
    const sportGap=x.sportModelProbability-x.marketProb;
    const stalePenalty=x.freshness==='STALE'?.08:x.freshness==='AGING'?.03:0;
    const agreementBoost=Math.max(0,x.agreement-.65)*.3;
    const score=Math.max(0,Math.min(1,Math.abs(simGap)*2.8+Math.abs(sportGap)*1.7+agreementBoost-stalePenalty));
    const severity:AnomalySignal['severity']=score>=.28?'HIGH':score>=.16?'MEDIUM':'LOW';
    const direction=simGap>=0?'above':'below';
    return {
      id:x.id,
      severity,
      sport:x.sport,
      selection:x.selection,
      score,
      reason:'Simulation is '+(Math.abs(simGap)*100).toFixed(1)+' points '+direction+' market probability; model agreement '+(x.agreement*100).toFixed(0)+'%.'
    };
  }).filter(x=>x.score>=.10).sort((a,b)=>b.score-a.score);
}
