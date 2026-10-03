import type {Scanned} from './scanner';
import {correlationExposure} from './sameGameCorrelation';
import {stressPortfolio,type PortfolioStressResult} from './portfolioStress';

export type PortfolioLimits={
 bankroll:number;
 dailyRiskPct:number;
 weeklyRiskPct:number;
 maxEventPct:number;
 maxSportPct:number;
 maxPositionPct:number;
 maxCorrelatedPct:number;
 drawdownBrakePct:number;
 stressDrawdownLimitPct:number;
 maxStressCvarPct:number;
 stressRuns:number;
 minDynamicConfidence:number;
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
 drawdownBrake:number;
 stressScale:number;
 stress:PortfolioStressResult;
};

function correlation(a:Scanned,b:Scanned){return correlationExposure(a,b)}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

export function defaultLimits(bankroll=1000):PortfolioLimits{
 return {
  bankroll,
  dailyRiskPct:.08,
  weeklyRiskPct:.18,
  maxEventPct:.035,
  maxSportPct:.06,
  maxPositionPct:.025,
  maxCorrelatedPct:.045,
  drawdownBrakePct:.12,
  stressDrawdownLimitPct:clamp(Number(process.env.PORTFOLIO_STRESS_DRAWDOWN_PCT||.10),.03,.30),
  maxStressCvarPct:clamp(Number(process.env.PORTFOLIO_MAX_CVAR_PCT||.06),.02,.20),
  stressRuns:Math.max(250,Math.min(5000,Number(process.env.PORTFOLIO_STRESS_RUNS||1500))),
  minDynamicConfidence:clamp(Number(process.env.PORTFOLIO_MIN_DYNAMIC_CONFIDENCE||.45),.20,.90)
 };
}

export function drawdownBrakeFactor(drawdownPct:number,trigger=.12){
 const d=Math.max(0,drawdownPct);
 const t=Math.max(.06,trigger);
 if(d<=.03)return 1;
 if(d<=.08)return 1-(d-.03)/.05*.20;
 if(d<=t){
  const span=Math.max(.01,t-.08);
  return .80-(d-.08)/span*.25;
 }
 if(d<=.20){
  const span=Math.max(.01,.20-t);
  return .55-(d-t)/span*.25;
 }
 return .25;
}

function regimeScale(leg:Scanned){
 if(leg.regime==='DISLOCATED')return .55;
 if(leg.regime==='VOLATILE')return .78;
 if(leg.regime==='THIN')return .70;
 if(leg.regime==='UNKNOWN')return .82;
 return 1;
}

function scalePositions(positions:PortfolioPosition[],scale:number,bankroll:number){
 return positions.map(p=>({
  ...p,
  stake:p.stake*scale,
  stakePct:p.stakePct*scale,
  marginalEv:p.marginalEv*scale,
  eventExposurePct:p.eventExposurePct*scale,
  sportExposurePct:p.sportExposurePct*scale,
  correlationExposurePct:p.correlationExposurePct*scale
 }));
}

export function optimizePortfolio(rows:Scanned[],limits:PortfolioLimits,drawdownPct=0):PortfolioResult{
 const brake=drawdownBrakeFactor(drawdownPct,limits.drawdownBrakePct);
 const dailyCap=limits.bankroll*limits.dailyRiskPct*brake;
 const sorted=[...rows]
  .filter(x=>(x.grade==='ELITE'||x.grade==='STRONG')&&(x.dynamicConfidence??x.confidence)>=limits.minDynamicConfidence)
  .sort((a,b)=>{
   const score=(x:Scanned)=>x.expectedValue*(.55+.45*(x.dynamicConfidence??x.confidence))*regimeScale(x);
   return score(b)-score(a);
  });
 let positions:PortfolioPosition[]=[];
 const rejected:{id:string;reason:string}[]=[];
 let totalStake=0;

 for(const leg of sorted){
  const confidence=clamp(leg.dynamicConfidence??leg.confidence,.2,1);
  const uncertaintyScale=clamp(.45+.55*confidence,.35,1);
  const basePct=Math.min(limits.maxPositionPct,Math.max(0,leg.recommendedStake));
  let stake=limits.bankroll*basePct*brake*uncertaintyScale*regimeScale(leg);
  if(stake<=0){rejected.push({id:leg.id,reason:'No positive confidence-adjusted allocation'});continue;}

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

 let stress=stressPortfolio(
  positions.map(p=>({id:p.id,leg:p.leg,stake:p.stake})),
  limits.bankroll,
  limits.stressRuns,
  limits.stressDrawdownLimitPct
 );
 const observedCvarPct=stress.worstScenario.cvar95Loss/Math.max(1,limits.bankroll);
 const stressScale=observedCvarPct>limits.maxStressCvarPct
  ?clamp(limits.maxStressCvarPct/observedCvarPct,.15,1)
  :1;

 if(stressScale<.999){
  positions=scalePositions(positions,stressScale,limits.bankroll);
  stress=stressPortfolio(
   positions.map(p=>({id:p.id,leg:p.leg,stake:p.stake})),
   limits.bankroll,
   limits.stressRuns,
   limits.stressDrawdownLimitPct
  );
 }

 totalStake=positions.reduce((s,p)=>s+p.stake,0);
 const expectedProfit=positions.reduce((s,p)=>s+p.marginalEv,0);
 return {
  positions,totalStake,totalStakePct:totalStake/limits.bankroll,
  expectedProfit,expectedRoi:totalStake?expectedProfit/totalStake:0,rejected,
  drawdownBrake:brake,stressScale,stress
 };
}
