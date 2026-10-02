import type {Market,Ranked,RiskProfile} from './types';
import {ev,fairAmerican,kelly} from './math';
import {modelCouncil} from './modelCouncil';

export function rankMarkets(rows:Market[],profile:RiskProfile='Moderate'):Ranked[]{
 const frac=profile==='Conservative'?.25:profile==='Moderate'?.35:.5;
 return rows.map(m=>{
  const c=modelCouncil(m);
  const p=c.ensemble;
  const marketFair=m.noVigProb??m.marketProb;
  const edge=p-marketFair;
  const predictionEdge=typeof m.predictionProb==='number'?p-m.predictionProb:undefined;
  const expectedValue=ev(p,m.odds);
  const fullKelly=kelly(p,m.odds);
  const quarterKelly=Math.max(0,Math.min(.05,fullKelly*.25));
  const recommendedStake=Math.max(0,Math.min(.05,fullKelly*frac));
  const quality=m.dataQuality??1;
  const modelConflictPenalty=c.dispersion>.07?.012:0;
  const adjustedEdge=edge-modelConflictPenalty-(quality<.65?.01:0);
  const grade:Ranked['grade']=expectedValue>=.08&&adjustedEdge>=.05&&c.agreement>=.70?'ELITE':expectedValue>=.03&&adjustedEdge>=.025&&c.agreement>=.55?'STRONG':expectedValue>0?'WATCH':'PASS';
  return {
   ...m,
   modelProb:p,
   fairOdds:fairAmerican(p),
   edge,
   predictionEdge,
   expectedValue,
   kelly:fullKelly,
   quarterKelly,
   recommendedStake,
   agreement:c.agreement,
   sportModelProbability:c.sport.adjustedProbability,
   sportAdjustment:c.sport.adjustment,
   sportFactors:c.sport.factors,
   grade
  };
 }).sort((a,b)=>b.expectedValue-a.expectedValue||b.edge-a.edge)
}

export function top30(rows:Market[],profile:RiskProfile='Moderate'){
 return rankMarkets(rows,profile).filter(x=>x.grade!=='PASS').slice(0,30);
}
