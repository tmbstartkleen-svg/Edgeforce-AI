import type {Scanned} from './scanner';
import type {PortfolioLimits} from './portfolio';
import {optimizePortfolio} from './portfolio';
import {staleLineAlert} from './alerts';
import {nextPositionState, type PositionState} from './lifecycle';

export type ExistingPosition={id:string;marketId:string;state:PositionState;stake:number;previousEv?:number};
export type DecisionAction={
 marketId:string;
 action:PositionState;
 reason:string[];
 expectedValue:number;
 stake?:number;
};

export function runDecisionEngine(
 rows:Scanned[],
 limits:PortfolioLimits,
 existing:ExistingPosition[]=[],
 drawdownPct=0
){
 const portfolio=optimizePortfolio(rows,limits,drawdownPct);
 const chosen=new Map(portfolio.positions.map(p=>[p.id,p]));
 const decisions:DecisionAction[]=[];
 const alerts=rows.map(r=>staleLineAlert(r.id,r.sourceAgeMin)).filter(Boolean);

 for(const row of rows){
  const current=existing.find(p=>p.marketId===row.id);
  const selected=chosen.get(row.id);
  const rejected=portfolio.rejected.find(r=>r.id===row.id);
  const stale=row.freshness==='STALE';
  const state=nextPositionState({
   state:current?.state||'CANDIDATE',
   expectedValue:row.expectedValue,
   probability:row.simProbability,
   stale,
   drawdownBrake:drawdownPct>=limits.drawdownBrakePct,
   correlationBreach:rejected?.reason==='Correlation exposure limit'
  });
  const reason=[
   stale?'Stale market data':null,
   rejected?.reason||null,
   selected?`Portfolio stake ${selected.stake.toFixed(2)}`:null,
   row.expectedValue>0?`EV +${(row.expectedValue*100).toFixed(1)}%`:'Non-positive EV',
   `Agreement ${(row.agreement*100).toFixed(0)}%`
  ].filter((x):x is string=>Boolean(x));
  decisions.push({marketId:row.id,action:state,reason,expectedValue:row.expectedValue,stake:selected?.stake});
 }

 for(const current of existing){
  if(!rows.some(r=>r.id===current.marketId)){
   decisions.push({marketId:current.marketId,action:'REMOVE',reason:['Market no longer in active scan'],expectedValue:0});
  }
 }

 return {portfolio,decisions,alerts};
}
