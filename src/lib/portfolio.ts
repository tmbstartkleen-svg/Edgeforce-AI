import type {Scanned} from './scanner';
import {correlationExposure} from './sameGameCorrelation';

export type PortfolioLimits={
 bankroll:number;
 dailyRiskPct:number;
 weeklyRiskPct:number;
 maxEventPct:number;
 maxSportPct:number;
 maxPositionPct:number;
 maxCorrelatedPct:number;
 drawdownBrakePct:number;
};

export type PortfolioPosition={
 id:string;
 leg:Scanned;
 stake:number;
 stakePct:number;
 marginalEv:number;
 eventExposurePct:number;
 sportExposurePct:number;
 correlationExposurePct:number;
};

export type PortfolioResult={
 positions:PortfolioPosition[];
 totalStake:number;
 totalStakePct:number;
 expectedProfit:number;
 expectedRoi:number;
 rejected:{id:string;reason:string}[];
};

const sameEvent=(a:Scanned,b:Scanned)=>a.event===b.event;
const sameSport=(a:Scanned,b:Scanned)=>a.sport===b.sport;

function correlation(a:Scanned,b:Scanned){return correlationExposure(a,b)}

export function defaultLimits(bankroll=1000):PortfolioLimits{
 return {bankroll,dailyRiskPct:.08,weeklyRiskPct:.18,maxEventPct:.035,maxSportPct:.06,maxPositionPct:.025,maxCorrelatedPct:.045,drawdownBrakePct:.12};
}

export function optimizePortfolio(rows:Scanned[],limits:PortfolioLimits,drawdownPct=0):PortfolioResult{
 const brake=drawdownPct>=limits.drawdownBrakePct?.5:1;
 const dailyCap=limits.bankroll*limits.dailyRiskPct*brake;
 const sorted=[...rows].filter(x=>x.grade==='ELITE'||x.grade==='STRONG').sort((a,b)=>(b.expectedValue*b.agreement)-(a.expectedValue*a.agreement));
 const positions:PortfolioPosition[]=[];
 const rejected:{id:string;reason:string}[]=[];
 let totalStake=0;

 for(const leg of sorted){
  const basePct=Math.min(limits.maxPositionPct,Math.max(0,leg.recommendedStake));
  let stake=limits.bankroll*basePct*brake;
  if(stake<=0){rejected.push({id:leg.id,reason:'No positive Kelly allocation'});continue;}

  const eventExposure=positions.filter(p=>p.leg.event===leg.event).reduce((s,p)=>s+p.stake,0)/limits.bankroll;
  const sportExposure=positions.filter(p=>p.leg.sport===leg.sport).reduce((s,p)=>s+p.stake,0)/limits.bankroll;
  const corrExposure=positions.reduce((s,p)=>s+p.stake*correlation(p.leg,leg),0)/limits.bankroll;

  if(eventExposure+stake/limits.bankroll>limits.maxEventPct){rejected.push({id:leg.id,reason:'Event exposure limit'});continue;}
  if(sportExposure+stake/limits.bankroll>limits.maxSportPct){rejected.push({id:leg.id,reason:'Sport exposure limit'});continue;}
  if(corrExposure+stake/limits.bankroll>limits.maxCorrelatedPct){rejected.push({id:leg.id,reason:'Correlation exposure limit'});continue;}
  if(totalStake+stake>dailyCap)stake=Math.max(0,dailyCap-totalStake);
  if(stake<limits.bankroll*.0025){rejected.push({id:leg.id,reason:'Daily risk budget exhausted'});continue;}

  positions.push({
   id:leg.id,leg,stake,stakePct:stake/limits.bankroll,
   marginalEv:stake*leg.expectedValue,
   eventExposurePct:eventExposure+stake/limits.bankroll,
   sportExposurePct:sportExposure+stake/limits.bankroll,
   correlationExposurePct:corrExposure+stake/limits.bankroll
  });
  totalStake+=stake;
  if(totalStake>=dailyCap)break;
 }

 const expectedProfit=positions.reduce((s,p)=>s+p.marginalEv,0);
 return {positions,totalStake,totalStakePct:totalStake/limits.bankroll,expectedProfit,expectedRoi:totalStake?expectedProfit/totalStake:0,rejected};
}
