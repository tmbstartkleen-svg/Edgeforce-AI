import type {Scanned} from './scanner';

export type PortfolioStressScenario='BASE'|'MODEL_MISS'|'MARKET_DISLOCATION'|'CORRELATED_SLATE'|'DRAWDOWN';

export type StressPosition={
 id:string;
 leg:Scanned;
 stake:number;
};

export type StressScenarioResult={
 scenario:PortfolioStressScenario;
 runs:number;
 meanPnl:number;
 p05:number;
 p10:number;
 p50:number;
 p90:number;
 p95:number;
 volatility:number;
 probabilityOfLoss:number;
 drawdownBreachProbability:number;
 var95Loss:number;
 cvar95Loss:number;
 maxLoss:number;
};

export type PortfolioStressResult={
 runsPerScenario:number;
 drawdownLimitPct:number;
 scenarios:StressScenarioResult[];
 worstScenario:StressScenarioResult;
 baseScenario:StressScenarioResult;
};

const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));

function hashSeed(s:string){
 let h=2166136261;
 for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
 return h||123456789;
}
function xorshift32(x:number){x^=x<<13;x^=x>>>17;x^=x<<5;return x|0}
function rng(seed:string){
 let state=hashSeed(seed);
 const next=()=>{state=xorshift32(state);return (state>>>0)/4294967296};
 const normal=()=>{
  const u1=Math.max(1e-12,next()),u2=Math.max(1e-12,next());
  return Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
 };
 return {normal};
}

function invNorm(p:number){
 const x=clamp(p,1e-8,1-1e-8);
 const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924];
 const b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857];
 const c=[-.00778489400243029,-.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878];
 const d=[.00778469570904146,.32246712907004,2.445134137143,3.75440866190742];
 const plow=.02425,phigh=1-plow;
 if(x<plow){
  const q=Math.sqrt(-2*Math.log(x));
  return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
 }
 if(x>phigh){
  const q=Math.sqrt(-2*Math.log(1-x));
  return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
 }
 const q=x-.5,r=q*q;
 return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

function profitMultiple(odds:number){
 return odds>=0?odds/100:100/Math.max(1,Math.abs(odds));
}

function eventKey(leg:Scanned){return [leg.sport,leg.event,leg.startTime].join('|').toLowerCase()}
function sportKey(leg:Scanned){return String(leg.sport||'unknown').toLowerCase()}

function stressedProbability(leg:Scanned,scenario:PortfolioStressScenario){
 const p=clamp(leg.simProbability,.001,.999);
 const market=clamp(leg.marketProb,.001,.999);
 if(scenario==='BASE')return p;
 if(scenario==='MODEL_MISS')return clamp(market+(p-market)*.45,.001,.999);
 if(scenario==='MARKET_DISLOCATION'){
  const regimePenalty=leg.regime==='DISLOCATED'?.025:leg.regime==='VOLATILE'?.012:0;
  return clamp(market+(p-market)*.30-regimePenalty,.001,.999);
 }
 if(scenario==='CORRELATED_SLATE')return clamp(market+(p-market)*.55-.01,.001,.999);
 return clamp(market+(p-market)*.22-.018,.001,.999);
}

function factorWeights(scenario:PortfolioStressScenario){
 if(scenario==='CORRELATED_SLATE')return {slate:.42,sport:.18,event:.24};
 if(scenario==='DRAWDOWN')return {slate:.34,sport:.18,event:.25};
 if(scenario==='MARKET_DISLOCATION')return {slate:.26,sport:.16,event:.24};
 return {slate:.18,sport:.12,event:.25};
}

function quantile(sorted:number[],q:number){
 if(!sorted.length)return 0;
 return sorted[Math.min(sorted.length-1,Math.max(0,Math.round((sorted.length-1)*q)))];
}

function summarize(values:number[],scenario:PortfolioStressScenario,runs:number,bankroll:number,drawdownLimitPct:number):StressScenarioResult{
 if(!values.length)return {scenario,runs:0,meanPnl:0,p05:0,p10:0,p50:0,p90:0,p95:0,volatility:0,probabilityOfLoss:0,drawdownBreachProbability:0,var95Loss:0,cvar95Loss:0,maxLoss:0};
 const sorted=[...values].sort((a,b)=>a-b);
 const mean=values.reduce((s,x)=>s+x,0)/values.length;
 const variance=values.reduce((s,x)=>s+(x-mean)**2,0)/values.length;
 const p05=quantile(sorted,.05);
 const tail=sorted.filter(x=>x<=p05);
 const cvar=tail.length?tail.reduce((s,x)=>s+x,0)/tail.length:p05;
 const drawdownThreshold=-Math.abs(bankroll*drawdownLimitPct);
 return {
  scenario,runs,
  meanPnl:mean,
  p05,p10:quantile(sorted,.10),p50:quantile(sorted,.50),p90:quantile(sorted,.90),p95:quantile(sorted,.95),
  volatility:Math.sqrt(variance),
  probabilityOfLoss:values.filter(x=>x<0).length/values.length,
  drawdownBreachProbability:values.filter(x=>x<=drawdownThreshold).length/values.length,
  var95Loss:Math.max(0,-p05),
  cvar95Loss:Math.max(0,-cvar),
  maxLoss:Math.max(0,-sorted[0])
 };
}

function runScenario(positions:StressPosition[],scenario:PortfolioStressScenario,bankroll:number,runs:number,drawdownLimitPct:number){
 const random=rng(['portfolio',scenario,...positions.map(x=>x.id),bankroll.toFixed(2)].join('|'));
 const weights=factorWeights(scenario);
 const residual=Math.max(.05,1-weights.slate-weights.sport-weights.event);
 const sports=[...new Set(positions.map(x=>sportKey(x.leg)))];
 const events=[...new Set(positions.map(x=>eventKey(x.leg)))];
 const thresholds=positions.map(x=>invNorm(stressedProbability(x.leg,scenario)));
 const pnls:number[]=[];

 for(let run=0;run<runs;run++){
  const slateZ=random.normal();
  const sportZ=new Map(sports.map(x=>[x,random.normal()]));
  const eventZ=new Map(events.map(x=>[x,random.normal()]));
  let pnl=0;
  for(let i=0;i<positions.length;i++){
   const position=positions[i];
   const latent=
    Math.sqrt(weights.slate)*slateZ+
    Math.sqrt(weights.sport)*(sportZ.get(sportKey(position.leg))||0)+
    Math.sqrt(weights.event)*(eventZ.get(eventKey(position.leg))||0)+
    Math.sqrt(residual)*random.normal();
   const won=latent<=thresholds[i];
   pnl+=won?position.stake*profitMultiple(position.leg.odds):-position.stake;
  }
  pnls.push(pnl);
 }
 return summarize(pnls,scenario,runs,bankroll,drawdownLimitPct);
}

export function stressPortfolio(positions:StressPosition[],bankroll:number,runsPerScenario=1500,drawdownLimitPct=.10):PortfolioStressResult{
 const runs=Math.max(250,Math.min(5000,Math.round(runsPerScenario)));
 const scenarios:PortfolioStressScenario[]=['BASE','MODEL_MISS','MARKET_DISLOCATION','CORRELATED_SLATE','DRAWDOWN'];
 const results=scenarios.map(s=>runScenario(positions,s,bankroll,runs,drawdownLimitPct));
 const baseScenario=results.find(x=>x.scenario==='BASE')||results[0];
 const worstScenario=[...results].sort((a,b)=>b.cvar95Loss-a.cvar95Loss||b.var95Loss-a.var95Loss)[0]||baseScenario;
 return {runsPerScenario:runs,drawdownLimitPct,scenarios:results,worstScenario,baseScenario};
}
