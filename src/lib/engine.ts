import type {Market,Ranked,RiskProfile} from './types';
import {ev,fairAmerican,kelly} from './math';
import {modelCouncil} from './modelCouncil';
export function rankMarkets(rows:Market[],profile:RiskProfile='Moderate'):Ranked[]{
 const frac=profile==='Conservative'?.2:profile==='Moderate'?.35:.5;
 return rows.map(m=>{
  const c=modelCouncil(m);
  const p=c.ensemble;
  const edge=p-m.marketProb;
  const expectedValue=ev(p,m.odds);
  const fullKelly=kelly(p,m.odds);
  const recommendedStake=Math.max(0,Math.min(.05,fullKelly*frac));
  const grade:Ranked['grade']=expectedValue>=.08&&edge>=.05&&c.agreement>=.7?'ELITE':expectedValue>=.03&&edge>=.025?'STRONG':expectedValue>0?'WATCH':'PASS';
  return {...m,modelProb:p,fairOdds:fairAmerican(p),edge,expectedValue,kelly:fullKelly,recommendedStake,agreement:c.agreement,grade};
 }).sort((a,b)=>b.expectedValue-a.expectedValue||b.edge-a.edge)
}
export function top30(rows:Market[],profile:RiskProfile='Moderate'){return rankMarkets(rows,profile).filter(x=>x.grade!=='PASS').slice(0,30)}
