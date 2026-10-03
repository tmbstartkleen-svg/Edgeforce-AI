import type {Market,Ranked,RiskProfile} from './types';
import {ev,fairAmerican,kelly} from './math';
import {modelCouncil} from './modelCouncil';
import type {LearnedWeightMap} from './learnedWeights';

export function rankMarkets(rows:Market[],profile:RiskProfile='Moderate',learnedWeights?:LearnedWeightMap):Ranked[]{
 const frac=profile==='Conservative'?.2:profile==='Moderate'?.35:.5;
 return rows.map(m=>{
  const c=modelCouncil(m,learnedWeights);
  const p=c.ensemble;
  const edge=p-m.marketProb;
  const expectedValue=ev(p,m.odds);
  const fullKelly=kelly(p,m.odds);
  const consensusAgreement=m.consensus?.agreement;
  const consensusDepth=m.consensus?.bookCount??0;
  const consensusStakeScale=m.consensus?Math.max(.55,Math.min(1,.65+.35*m.consensus.agreement)):1;
  const recommendedStake=Math.max(0,Math.min(.05,fullKelly*frac*consensusStakeScale));
  const modelConflictPenalty=c.dispersion>.06?.01:0;
  const marketConflictPenalty=m.consensus
   ?(consensusDepth<2?.012:Math.max(0,.72-(consensusAgreement??0))*.05)
   :0;
  const adjustedEdge=edge-modelConflictPenalty-marketConflictPenalty;
  const consensusGate=!m.consensus||(consensusDepth>=2&&(consensusAgreement??0)>=.65);
  const grade:Ranked['grade']=expectedValue>=.08&&adjustedEdge>=.05&&c.agreement>=.7&&consensusGate?'ELITE':expectedValue>=.03&&adjustedEdge>=.025?'STRONG':expectedValue>0?'WATCH':'PASS';
  return {
   ...m,
   modelProb:p,
   fairOdds:fairAmerican(p),
   edge,
   expectedValue,
   kelly:fullKelly,
   recommendedStake,
   agreement:c.agreement,
   sportModelProbability:c.sport.adjustedProbability,
   sportAdjustment:c.sport.adjustment,
   sportFactors:c.sport.factors,
   modelVotes:c.votes.map(v=>({name:v.name,prob:v.prob,baseWeight:v.baseWeight,learnedMultiplier:v.learnedMultiplier,weight:v.weight})),
   grade
  };
 }).sort((a,b)=>b.expectedValue-a.expectedValue||b.edge-a.edge)
}

export function top30(rows:Market[],profile:RiskProfile='Moderate',learnedWeights?:LearnedWeightMap){
 return rankMarkets(rows,profile,learnedWeights).filter(x=>x.grade!=='PASS').slice(0,30);
}
