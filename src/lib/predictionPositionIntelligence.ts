import type {PredictionContract} from './predictionMarkets';
import {crossVenueGaps} from './predictionFlow';

export type PredictionPositionSide='YES'|'NO';
export type PositionAction='ADD'|'HOLD'|'TRIM'|'TAKE_PROFIT'|'EXIT'|'NO_SIGNAL';
export type PositionTiming='NOW'|'PATIENT'|'REVIEW';

export type PredictionPosition={
 id:number;
 venue:string;
 contractId:string;
 title:string;
 category:string;
 side:PredictionPositionSide;
 quantity:number;
 avgEntryProbability:number;
 entryFee:number;
 fairProbabilityAtEntry?:number;
 modelSource?:string;
 openedAt:string;
 notes?:string;
};

export type PositionIntelligence={
 position:PredictionPosition;
 current?:{
  probability:number;
  bidProbability?:number;
  askProbability?:number;
  executableExitProbability:number;
  executableBuyProbability:number;
 };
 fair?:{
  yesProbability:number;
  sideProbability:number;
  source:string;
  confidence:number;
 };
 action:PositionAction;
 timing:PositionTiming;
 score:number;
 remainingEdge:number;
 unrealizedPnl:number;
 unrealizedRoi:number;
 entryCost:number;
 currentExitValue:number;
 addBelowProbability:number;
 takeProfitAboveProbability:number;
 reasons:string[];
 riskFlags:string[];
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const venueKey=(value:string)=>String(value||'').trim().toLowerCase();

function sidePrice(side:PredictionPositionSide,yesPrice:number){
 return side==='YES'?yesPrice:1-yesPrice;
}

function currentPrices(side:PredictionPositionSide,contract:PredictionContract){
 const mid=clamp(contract.yesProbability,.001,.999);
 const yesBid=contract.bidProbability===undefined?mid:clamp(contract.bidProbability,.001,.999);
 const yesAsk=contract.askProbability===undefined?mid:clamp(contract.askProbability,.001,.999);
 if(side==='YES'){
  return {
   probability:mid,
   bidProbability:contract.bidProbability,
   askProbability:contract.askProbability,
   executableExitProbability:yesBid,
   executableBuyProbability:yesAsk
  };
 }
 return {
  probability:1-mid,
  bidProbability:contract.askProbability===undefined?undefined:1-yesAsk,
  askProbability:contract.bidProbability===undefined?undefined:1-yesBid,
  executableExitProbability:1-yesAsk,
  executableBuyProbability:1-yesBid
 };
}

function crossVenueReference(position:PredictionPosition,contracts:PredictionContract[]){
 const gaps=crossVenueGaps(contracts,500);
 const venue=venueKey(position.venue);
 for(const gap of gaps){
  const kalshiMatch=venue==='kalshi'&&gap.kalshi.id===position.contractId;
  const polyMatch=venue==='polymarket'&&gap.polymarket.id===position.contractId;
  if(!kalshiMatch&&!polyMatch)continue;
  const other=kalshiMatch?gap.polymarket:gap.kalshi;
  const confidence=gap.matchQuality==='STRONG'
   ?clamp(.72+gap.similarity*.20,.72,.94)
   :clamp(.45+gap.similarity*.25,.45,.68);
  return {
   yesProbability:clamp(other.yesProbability,.001,.999),
   sideProbability:sidePrice(position.side,clamp(other.yesProbability,.001,.999)),
   source:`${other.source} cross-venue reference`,
   confidence
  };
 }
 return null;
}

function entryReference(position:PredictionPosition){
 if(position.fairProbabilityAtEntry===undefined)return null;
 const yes=clamp(position.fairProbabilityAtEntry,.001,.999);
 return {
  yesProbability:yes,
  sideProbability:sidePrice(position.side,yes),
  source:position.modelSource||'stored fair value',
  confidence:.62
 };
}

export function evaluatePredictionPosition(
 position:PredictionPosition,
 contracts:PredictionContract[]
):PositionIntelligence{
 const contract=contracts.find(x=>venueKey(x.source)===venueKey(position.venue)&&x.id===position.contractId);
 const reasons:string[]=[];
 const riskFlags:string[]=[];

 if(!contract){
  return {
   position,
   action:'NO_SIGNAL',
   timing:'REVIEW',
   score:0,
   remainingEdge:0,
   unrealizedPnl:0,
   unrealizedRoi:0,
   entryCost:position.quantity*position.avgEntryProbability+position.entryFee,
   currentExitValue:0,
   addBelowProbability:position.avgEntryProbability,
   takeProfitAboveProbability:position.avgEntryProbability,
   reasons:['current contract quote is unavailable; do not infer an exit decision from stale data'],
   riskFlags:['QUOTE_UNAVAILABLE']
  };
 }

 const current=currentPrices(position.side,contract);
 const fair=crossVenueReference(position,contracts)||entryReference(position)||{
  yesProbability:contract.yesProbability,
  sideProbability:sidePrice(position.side,contract.yesProbability),
  source:'same-venue mark only',
  confidence:.30
 };

 if(fair.source==='same-venue mark only')riskFlags.push('NO_INDEPENDENT_FAIR_VALUE');
 if(contract.bidProbability===undefined||contract.askProbability===undefined)riskFlags.push('NO_EXECUTABLE_SPREAD');
 const spread=contract.bidProbability!==undefined&&contract.askProbability!==undefined
  ?Math.max(0,contract.askProbability-contract.bidProbability)
  :undefined;
 if(spread!==undefined&&spread>=.08)riskFlags.push('WIDE_SPREAD');
 if((contract.liquidity??0)>0&&(contract.liquidity??0)<1000)riskFlags.push('THIN_LIQUIDITY');

 const fairSide=clamp(fair.sideProbability,.001,.999);
 const remainingEdge=fairSide-current.executableBuyProbability;
 const exitPremium=current.executableExitProbability-fairSide;
 const entryCost=position.quantity*position.avgEntryProbability+position.entryFee;
 const currentExitValue=position.quantity*current.executableExitProbability;
 const unrealizedPnl=currentExitValue-entryCost;
 const unrealizedRoi=entryCost>0?unrealizedPnl/entryCost:0;

 const entryBuffer=fair.confidence>=.80?.025:fair.confidence>=.60?.035:.05;
 const addBelowProbability=clamp(fairSide-entryBuffer,.01,.99);
 const takeProfitAboveProbability=clamp(fairSide+.02,.01,.99);

 let action:PositionAction='HOLD';
 let timing:PositionTiming='PATIENT';

 const thesisBroken=fair.confidence>=.55&&fairSide<=position.avgEntryProbability-.07;
 const overFair=fair.confidence>=.55&&exitPremium>=.025;
 const strongAdd=fair.confidence>=.62&&remainingEdge>=.05;
 const moderateAdd=fair.confidence>=.70&&remainingEdge>=.03;
 const noEdge=fair.confidence>=.55&&remainingEdge<=-.02;

 if(thesisBroken||noEdge){
  action='EXIT';
  timing='NOW';
 }else if(overFair&&unrealizedPnl>0){
  action='TAKE_PROFIT';
  timing='NOW';
 }else if(overFair){
  action='TRIM';
  timing='NOW';
 }else if(strongAdd||moderateAdd){
  action='ADD';
  timing=spread!==undefined&&spread>.04?'PATIENT':'NOW';
 }else if(fair.confidence<.50){
  action='NO_SIGNAL';
  timing='REVIEW';
 }else{
  action='HOLD';
  timing='PATIENT';
 }

 const edgeScore=clamp(Math.abs(remainingEdge)/.10)*30;
 const fairScore=fair.confidence*30;
 const pnlScore=clamp(Math.abs(unrealizedRoi)/.30)*15;
 const spreadScore=spread===undefined?4:Math.max(0,12-clamp(spread/.10)*12);
 const actionScore=(action==='EXIT'||action==='TAKE_PROFIT'||action==='ADD')?13:action==='TRIM'?9:5;
 const penalty=riskFlags.length*5;
 const score=Math.round(clamp(edgeScore+fairScore+pnlScore+spreadScore+actionScore-penalty,0,100));

 reasons.push(
  `entry ${(position.avgEntryProbability*100).toFixed(1)}¢ equivalent • executable exit ${(current.executableExitProbability*100).toFixed(1)}¢`,
  `fair value ${(fairSide*100).toFixed(1)}% from ${fair.source} • confidence ${(fair.confidence*100).toFixed(0)}%`,
  `remaining entry edge ${remainingEdge>=0?'+':''}${(remainingEdge*100).toFixed(1)} pts • unrealized P/L ${unrealizedPnl>=0?'+':''}$${unrealizedPnl.toFixed(2)}`
 );

 if(action==='ADD')reasons.push(`add only at or below ${(addBelowProbability*100).toFixed(1)}¢ while the fair-value thesis remains intact`);
 if(action==='TAKE_PROFIT')reasons.push('executable exit price is above independent fair value; locking some or all gains is favored');
 if(action==='TRIM')reasons.push('current exit price is rich relative to fair value; reduce exposure rather than add');
 if(action==='EXIT')reasons.push('remaining edge is negative or the stored thesis has materially deteriorated');
 if(action==='NO_SIGNAL')reasons.push('independent fair-value evidence is not strong enough for a buy/sell instruction');

 return {
  position,current,fair,action,timing,score,
  remainingEdge,unrealizedPnl,unrealizedRoi,entryCost,currentExitValue,
  addBelowProbability,takeProfitAboveProbability,reasons,riskFlags
 };
}

export function evaluatePredictionPositions(
 positions:PredictionPosition[],
 contracts:PredictionContract[]
){
 return positions
  .map(position=>evaluatePredictionPosition(position,contracts))
  .sort((a,b)=>b.score-a.score||Math.abs(b.remainingEdge)-Math.abs(a.remainingEdge));
}
