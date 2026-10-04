import type {PredictionContract} from './predictionMarkets';
import type {CrossVenueGap,MarketMover,PredictionTrade} from './predictionFlow';
import type {buildTraderSignals} from './predictionTraderIntelligence';

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const logScore=(n:number,scale=6)=>clamp(Math.log10(1+Math.max(0,n))/scale);
const norm=(s:string)=>String(s||'').trim().toLowerCase();

export type PredictionResearchPriority='HIGH'|'MEDIUM'|'LOW';

export type PredictionOpportunity={
 venue:string;
 contractId:string;
 title:string;
 probability:number;
 bidProbability?:number;
 askProbability?:number;
 spread?:number;
 volume?:number;
 liquidity?:number;
 marketQuality:number;
 depthScore:number;
 spreadScore:number;
 divergenceScore:number;
 flowScore:number;
 momentumScore:number;
 traderScore:number;
 researchScore:number;
 priority:PredictionResearchPriority;
 directionalBias:'YES'|'NO'|'NEUTRAL';
 crossVenueGap?:number;
 notes:string[];
};

export type CrossVenueArbitrageCandidate={
 lowVenue:string;
 highVenue:string;
 lowContractId:string;
 highContractId:string;
 title:string;
 similarity:number;
 matchQuality:'STRONG'|'HEURISTIC';
 buyYesAsk:number;
 buyNoAsk:number;
 grossCost:number;
 grossEdge:number;
 settlementMismatchRisk:'LOWER'|'HIGH';
 executionReady:false;
 note:string;
};

type TraderSignalLike=ReturnType<typeof buildTraderSignals>[number];

function flowByMarket(trades:PredictionTrade[]){
 const map=new Map<string,{gross:number;net:number}>();
 for(const trade of trades){
  const key=[norm(trade.venue),trade.marketId].join('|');
  const prior=map.get(key)||{gross:0,net:0};
  prior.gross+=Math.max(0,trade.notional);
  prior.net+=trade.signedYesFlow;
  map.set(key,prior);
 }
 return map;
}

function moverByMarket(movers:MarketMover[]){
 const map=new Map<string,MarketMover>();
 for(const mover of movers){
  const key=[norm(mover.venue),mover.marketId].join('|');
  const prior=map.get(key);
  if(!prior||mover.absoluteChange>prior.absoluteChange)map.set(key,mover);
 }
 return map;
}

function traderByMarket(signals:TraderSignalLike[]){
 const map=new Map<string,number>();
 for(const signal of signals){
  const marketId=signal.latestTrade?.marketId;
  if(!marketId)continue;
  const key=['polymarket',marketId].join('|');
  map.set(key,Math.max(map.get(key)||0,clamp(signal.smartScore)));
 }
 return map;
}

function gapByContract(gaps:CrossVenueGap[]){
 const map=new Map<string,CrossVenueGap>();
 for(const gap of gaps){
  for(const contract of [gap.kalshi,gap.polymarket]){
   const key=[norm(contract.source),contract.id].join('|');
   const prior=map.get(key);
   if(!prior||gap.absoluteGap>prior.absoluteGap)map.set(key,gap);
  }
 }
 return map;
}

function direction(flowRatio:number,momentum:number){
 const signal=flowRatio*.65+momentum*.35;
 if(signal>=.18)return 'YES' as const;
 if(signal<=-.18)return 'NO' as const;
 return 'NEUTRAL' as const;
}

export function buildPredictionOpportunities(
 contracts:PredictionContract[],
 trades:PredictionTrade[],
 movers:MarketMover[],
 traderSignals:TraderSignalLike[],
 gaps:CrossVenueGap[],
 limit=100
):PredictionOpportunity[]{
 const flow=flowByMarket(trades);
 const mover=moverByMarket(movers);
 const trader=traderByMarket(traderSignals);
 const gap=gapByContract(gaps);

 return contracts.map(contract=>{
  const key=[norm(contract.source),contract.id].join('|');
  const spread=contract.bidProbability!==undefined&&contract.askProbability!==undefined
   ?Math.max(0,contract.askProbability-contract.bidProbability)
   :undefined;
  const depthBase=(contract.volume??0)+(contract.liquidity??0);
  const depthScore=logScore(depthBase);
  const spreadScore=spread===undefined?.45:clamp(1-spread/.12);
  const marketQuality=clamp(depthScore*.58+spreadScore*.42);

  const flowRow=flow.get(key);
  const flowRatio=flowRow?.gross?clamp(flowRow.net/flowRow.gross,-1,1):0;
  const flowScore=clamp(Math.abs(flowRatio));

  const moverRow=mover.get(key);
  const signedMomentum=moverRow?clamp(moverRow.probabilityChange/.15,-1,1):0;
  const momentumScore=Math.abs(signedMomentum);

  const traderScore=trader.get(key)||0;
  const gapRow=gap.get(key);
  const divergenceScore=gapRow?clamp(gapRow.absoluteGap/.20):0;

  const researchScore=clamp(
   marketQuality*.30+
   divergenceScore*.25+
   flowScore*.16+
   momentumScore*.14+
   traderScore*.15
  );

  const priority:PredictionResearchPriority=researchScore>=.72?'HIGH':researchScore>=.52?'MEDIUM':'LOW';
  const notes:string[]=[];
  if(divergenceScore>=.45)notes.push('material cross-venue probability divergence');
  if(flowScore>=.50)notes.push('concentrated recent directional flow');
  if(momentumScore>=.40)notes.push('meaningful recent price movement');
  if(traderScore>=.65)notes.push('high-scoring public trader activity');
  if(marketQuality>=.72)notes.push('strong liquidity/spread quality');
  if(spread!==undefined&&spread>.08)notes.push('wide spread reduces execution quality');
  if(!notes.length)notes.push('monitor; no dominant edge signal yet');

  return {
   venue:contract.source,
   contractId:contract.id,
   title:contract.title,
   probability:contract.yesProbability,
   bidProbability:contract.bidProbability,
   askProbability:contract.askProbability,
   spread,
   volume:contract.volume,
   liquidity:contract.liquidity,
   marketQuality,
   depthScore,
   spreadScore,
   divergenceScore,
   flowScore,
   momentumScore,
   traderScore,
   researchScore,
   priority,
   directionalBias:direction(flowRatio,signedMomentum),
   crossVenueGap:gapRow?.absoluteGap,
   notes
  };
 })
 .sort((a,b)=>b.researchScore-a.researchScore||b.marketQuality-a.marketQuality)
 .slice(0,Math.max(1,limit));
}

export function detectCrossVenueArbitrage(gaps:CrossVenueGap[],limit=40):CrossVenueArbitrageCandidate[]{
 const out:CrossVenueArbitrageCandidate[]=[];

 for(const gap of gaps){
  if(gap.matchQuality!=='STRONG')continue;

  const low=gap.lowerVenue==='Kalshi'?gap.kalshi:gap.polymarket;
  const high=gap.higherVenue==='Kalshi'?gap.kalshi:gap.polymarket;
  const yesAsk=low.askProbability;
  const highYesBid=high.bidProbability;
  if(yesAsk===undefined||highYesBid===undefined)continue;

  const noAsk=clamp(1-highYesBid,.001,.999);
  const grossCost=yesAsk+noAsk;
  const grossEdge=1-grossCost;
  if(grossEdge<=.0025)continue;

  out.push({
   lowVenue:low.source,
   highVenue:high.source,
   lowContractId:low.id,
   highContractId:high.id,
   title:low.title,
   similarity:gap.similarity,
   matchQuality:gap.matchQuality,
   buyYesAsk:yesAsk,
   buyNoAsk:noAsk,
   grossCost,
   grossEdge,
   settlementMismatchRisk:gap.similarity>=.86?'LOWER':'HIGH',
   executionReady:false,
   note:'Gross cross-venue price lock before fees, slippage, fill risk, transfer friction, and settlement-rule verification.'
  });
 }

 return out
  .sort((a,b)=>b.grossEdge-a.grossEdge||b.similarity-a.similarity)
  .slice(0,Math.max(1,limit));
}
