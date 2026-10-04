import type {PredictionContract} from './predictionMarkets';
import type {CrossVenueGap,FlowSummary,MarketMover} from './predictionFlow';
import {classifyPredictionContract,type PredictionCategory} from './predictionCategories';

export type PredictionDecisionAction='BUY_YES'|'BUY_NO'|'WATCH_YES'|'WATCH_NO'|'WAIT'|'AVOID';
export type PredictionEvidenceGrade='A'|'B'|'C';

export type PredictionDecisionSignal={
 signalKey:string;
 venue:string;
 contractId:string;
 sourceVenue:string;
 sourceContractId:string;
 title:string;
 category:PredictionCategory;
 direction:'YES'|'NO';
 action:PredictionDecisionAction;
 score:number;
 evidenceGrade:PredictionEvidenceGrade;
 matchQuality:'STRONG'|'HEURISTIC';
 similarity:number;
 fairYesProbability:number;
 fairOutcomeProbability:number;
 marketYesProbability:number;
 executionProbability:number;
 edge:number;
 entryProbability:number;
 takeProfitProbability:number;
 reviewFairProbability:number;
 spreadProbability?:number;
 volume?:number;
 liquidity?:number;
 flowSupport:number;
 momentumSupport:number;
 smartTraderSupport:number;
 reasons:string[];
 riskFlags:string[];
};

type TraderSignalLike={
 traderId:string;
 smartScore:number;
 rank?:number;
 pnl?:number;
 latestTrade:{marketId:string;title:string;direction:string};
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const norm=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const depth=(c:PredictionContract)=>(c.volume??0)+(c.liquidity??0);
const depthWeight=(c:PredictionContract)=>Math.max(1,Math.min(8,Math.log10(10+depth(c))));

function fairProbability(a:PredictionContract,b:PredictionContract){
 const aw=depthWeight(a),bw=depthWeight(b);
 return clamp((a.yesProbability*aw+b.yesProbability*bw)/(aw+bw),.001,.999);
}

function flowFor(flow:FlowSummary[],contract:PredictionContract){
 const exact=flow.find(x=>x.venue.toLowerCase()===contract.source.toLowerCase()&&x.marketId.toLowerCase()===contract.id.toLowerCase());
 if(exact)return exact;
 const title=norm(contract.title);
 return flow.find(x=>x.venue.toLowerCase()===contract.source.toLowerCase()&&norm(x.title)===title);
}

function moverFor(movers:MarketMover[],contract:PredictionContract){
 const exact=movers.find(x=>x.venue.toLowerCase()===contract.source.toLowerCase()&&x.marketId.toLowerCase()===contract.id.toLowerCase());
 if(exact)return exact;
 const title=norm(contract.title);
 return movers.find(x=>x.venue.toLowerCase()===contract.source.toLowerCase()&&norm(x.title)===title);
}

function traderSupportFor(traders:TraderSignalLike[],contract:PredictionContract,direction:'YES'|'NO'){
 const title=norm(contract.title);
 let best=0;
 for(const trader of traders){
  const sameId=trader.latestTrade.marketId.toLowerCase()===contract.id.toLowerCase();
  const sameTitle=norm(trader.latestTrade.title)===title;
  if(!sameId&&!sameTitle)continue;
  const dir=trader.latestTrade.direction.toUpperCase();
  const aligned=direction==='YES'
   ?(dir==='YES'||dir==='BUY')
   :(dir==='NO'||dir==='SELL');
  const signed=(aligned?1:-1)*clamp(trader.smartScore,0,1);
  if(Math.abs(signed)>Math.abs(best))best=signed;
 }
 return best;
}

function outcomeExecution(contract:PredictionContract,direction:'YES'|'NO'){
 if(direction==='YES'){
  return clamp(contract.askProbability??contract.yesProbability,.001,.999);
 }
 const yesBid=contract.bidProbability??contract.yesProbability;
 return clamp(1-yesBid,.001,.999);
}

function spread(contract:PredictionContract){
 if(contract.bidProbability===undefined||contract.askProbability===undefined)return undefined;
 return Math.max(0,contract.askProbability-contract.bidProbability);
}

function candidate(
 contract:PredictionContract,
 source:PredictionContract,
 direction:'YES'|'NO',
 fairYes:number,
 gap:CrossVenueGap,
 flow:FlowSummary[],
 movers:MarketMover[],
 traders:TraderSignalLike[]
):PredictionDecisionSignal{
 const fairOutcome=direction==='YES'?fairYes:1-fairYes;
 const execution=outcomeExecution(contract,direction);
 const edge=fairOutcome-execution;
 const marketYes=clamp(contract.yesProbability,.001,.999);
 const marketDepth=depth(contract);
 const marketSpread=spread(contract);
 const flowRow=flowFor(flow,contract);
 const mover=moverFor(movers,contract);
 const flowBias=flowRow?clamp((flowRow.yesShare-.5)*2,-1,1):0;
 const flowSupport=direction==='YES'?flowBias:-flowBias;
 const momentumBias=mover?clamp(mover.probabilityChange/.08,-1,1):0;
 const momentumSupport=direction==='YES'?momentumBias:-momentumBias;
 const smartTraderSupport=traderSupportFor(traders,contract,direction);

 const minEdge=Math.max(.015,Number(process.env.PREDICTION_SIGNAL_MIN_EDGE||.035));
 const minDepth=Math.max(0,Number(process.env.PREDICTION_SIGNAL_MIN_DEPTH||1000));
 const maxSpread=Math.max(.01,Number(process.env.PREDICTION_SIGNAL_MAX_SPREAD||.08));
 const requiredEdge=gap.matchQuality==='STRONG'?minEdge:Math.max(.06,minEdge+.02);

 const riskFlags:string[]=[];
 if(gap.matchQuality!=='STRONG')riskFlags.push('HEURISTIC_CONTRACT_MATCH');
 if(marketDepth<minDepth)riskFlags.push('THIN_MARKET');
 if(marketSpread===undefined)riskFlags.push('NO_EXECUTABLE_SPREAD');
 else if(marketSpread>maxSpread)riskFlags.push('WIDE_SPREAD');
 if(contract.expiresAt){
  const hours=(new Date(contract.expiresAt).getTime()-Date.now())/3600000;
  if(Number.isFinite(hours)&&hours<=2)riskFlags.push('NEAR_EXPIRY');
 }
 if(flowSupport<-.35)riskFlags.push('FLOW_AGAINST');
 if(momentumSupport<-.55)riskFlags.push('MOMENTUM_AGAINST');

 const executableSpread=marketSpread!==undefined;
 const hardAvoid=riskFlags.includes('NEAR_EXPIRY')||(marketSpread!==undefined&&marketSpread>.14);
 const fullyQualified=
  gap.matchQuality==='STRONG'&&
  edge>=requiredEdge&&
  marketDepth>=minDepth&&
  executableSpread&&
  (marketSpread??1)<=maxSpread;

 let action:PredictionDecisionAction;
 if(hardAvoid)action='AVOID';
 else if(fullyQualified)action=direction==='YES'?'BUY_YES':'BUY_NO';
 else if(edge>=.02)action=direction==='YES'?'WATCH_YES':'WATCH_NO';
 else action='WAIT';

 const matchScore=(gap.matchQuality==='STRONG'?1:.55)*20;
 const edgeScore=clamp(edge/.12,0,1)*32;
 const depthScore=clamp(Math.log10(1+marketDepth)/6,0,1)*10;
 const spreadScore=marketSpread===undefined?0:clamp(1-marketSpread/.10,0,1)*10;
 const flowScore=clamp((flowSupport+1)/2,0,1)*9;
 const momentumScore=clamp((momentumSupport+1)/2,0,1)*7;
 const traderScore=clamp((smartTraderSupport+1)/2,0,1)*8;
 const riskPenalty=riskFlags.length*3;
 const score=Math.round(clamp(matchScore+edgeScore+depthScore+spreadScore+flowScore+momentumScore+traderScore-riskPenalty,0,100));

 const evidenceGrade:PredictionEvidenceGrade=
  fullyQualified&&score>=75?'A':
  gap.matchQuality==='STRONG'&&score>=58?'B':'C';

 const takeProfitProbability=clamp(fairOutcome+Math.max(.015,Math.min(.05,edge*.35)),.01,.99);
 const reviewFairProbability=clamp(fairOutcome-Math.max(.025,requiredEdge*.75),.01,.99);

 const reasons=[
  `cross-venue fair YES ${(fairYes*100).toFixed(1)}% from ${contract.source} + ${source.source}`,
  `${direction} execution ${(execution*100).toFixed(1)}% vs fair ${(fairOutcome*100).toFixed(1)}% = ${edge>=0?'+':''}${(edge*100).toFixed(1)} pts`,
  `${gap.matchQuality.toLowerCase()} contract match ${(gap.similarity*100).toFixed(0)}% • depth ${Math.round(marketDepth).toLocaleString()}`
 ];
 if(flowRow)reasons.push(`4h flow supports ${direction} at ${(flowSupport*100).toFixed(0)}%`);
 if(mover)reasons.push(`4h momentum ${momentumSupport>=0?'supports':'opposes'} ${direction} (${mover.probabilityChange>=0?'+':''}${(mover.probabilityChange*100).toFixed(1)} pts)`);
 if(Math.abs(smartTraderSupport)>=.35)reasons.push(`public smart-trader evidence ${smartTraderSupport>0?'supports':'opposes'} ${direction}`);
 if(action==='BUY_YES'||action==='BUY_NO')reasons.push(`entry only at or below ${(execution*100).toFixed(1)}%; take-profit watch near ${(takeProfitProbability*100).toFixed(1)}%`);

 return {
  signalKey:[contract.source,contract.id,direction].join('|'),
  venue:contract.source,
  contractId:contract.id,
  sourceVenue:source.source,
  sourceContractId:source.id,
  title:contract.title,
  category:classifyPredictionContract(contract),
  direction,
  action,
  score,
  evidenceGrade,
  matchQuality:gap.matchQuality,
  similarity:gap.similarity,
  fairYesProbability:fairYes,
  fairOutcomeProbability:fairOutcome,
  marketYesProbability:marketYes,
  executionProbability:execution,
  edge,
  entryProbability:execution,
  takeProfitProbability,
  reviewFairProbability,
  spreadProbability:marketSpread,
  volume:contract.volume,
  liquidity:contract.liquidity,
  flowSupport,
  momentumSupport,
  smartTraderSupport,
  reasons,
  riskFlags
 };
}

export function buildPredictionDecisionSignals(
 contracts:PredictionContract[],
 gaps:CrossVenueGap[],
 flow:FlowSummary[],
 movers:MarketMover[],
 traders:TraderSignalLike[],
 limit=80
){
 const byId=new Map(contracts.map(x=>[[x.source.toLowerCase(),x.id.toLowerCase()].join('|'),x]));
 const out:PredictionDecisionSignal[]=[];

 for(const gap of gaps){
  const kalshi=byId.get(['kalshi',gap.kalshi.id.toLowerCase()].join('|'))||gap.kalshi;
  const polymarket=byId.get(['polymarket',gap.polymarket.id.toLowerCase()].join('|'))||gap.polymarket;
  const fairYes=fairProbability(kalshi,polymarket);

  const candidates=[
   candidate(kalshi,polymarket,'YES',fairYes,gap,flow,movers,traders),
   candidate(kalshi,polymarket,'NO',fairYes,gap,flow,movers,traders),
   candidate(polymarket,kalshi,'YES',fairYes,gap,flow,movers,traders),
   candidate(polymarket,kalshi,'NO',fairYes,gap,flow,movers,traders)
  ].sort((a,b)=>b.edge-a.edge||b.score-a.score);

  const best=candidates[0];
  if(best)out.push(best);
 }

 return out
  .sort((a,b)=>{
   const actionRank=(x:PredictionDecisionSignal)=>x.action.startsWith('BUY_')?3:x.action.startsWith('WATCH_')?2:x.action==='WAIT'?1:0;
   return actionRank(b)-actionRank(a)||b.score-a.score||b.edge-a.edge;
  })
  .slice(0,Math.max(1,limit));
}
