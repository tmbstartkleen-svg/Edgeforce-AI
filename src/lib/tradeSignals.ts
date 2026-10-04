import {fairAmerican} from './math';

export type TradeAction='BUY'|'BET'|'WATCH'|'HOLD'|'REDUCE'|'AVOID';
export type TradeTiming='NOW'|'PATIENT'|'WAIT'|'EXIT';

export type TradeSignal={
 action:TradeAction;
 timing:TradeTiming;
 score:number;
 venue:string;
 venueType:'SPORTSBOOK'|'PREDICTION_EXCHANGE';
 fairProbability:number;
 marketProbability:number;
 edge:number;
 expectedValue:number;
 entryMaxProbability:number;
 entryMinAmericanOdds:number;
 reduceAtProbability:number;
 confidence:number;
 reasons:string[];
 riskFlags:string[];
};

type SignalRow={
 simProbability:number;
 dynamicConfidence:number;
 grade:'ELITE'|'STRONG'|'WATCH'|'PASS';
 regime:string;
 freshness:string;
 contextQuality?:{recommendationReady?:boolean;coverage?:number};
 bestExecutionVenue?:{
  venue:string;
  type:'SPORTSBOOK'|'PREDICTION_EXCHANGE';
  edge:number;
  expectedValue:number;
  marketProbability:number;
  americanOdds?:number;
  feeAdjusted:boolean;
 };
 bestPredictionVenue?:{
  volume?:number;
  liquidity?:number;
  status:string;
 };
 lineMovement?:{
  direction:'TOWARD'|'AWAY'|'FLAT';
  steam:boolean;
  steamStrength:'NONE'|'WATCH'|'STRONG';
  probabilityMove:number;
  snapshotCount:number;
 }|null;
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

export function buildTradeSignal(row:SignalRow):TradeSignal{
 const venue=row.bestExecutionVenue?.venue||'No routed venue';
 const venueType=row.bestExecutionVenue?.type||'SPORTSBOOK';
 const fair=clamp(row.simProbability,.001,.999);
 const market=clamp(row.bestExecutionVenue?.marketProbability??fair,.001,.999);
 const edge=fair-market;
 const expectedValue=row.bestExecutionVenue?.expectedValue??0;
 const confidence=clamp(row.dynamicConfidence,.01,.99);
 const movement=row.lineMovement;
 const depth=(row.bestPredictionVenue?.volume??0)+(row.bestPredictionVenue?.liquidity??0);

 const requiredEdge=
  confidence>=.72?.025:
  confidence>=.62?.035:
  .05;

 const entryMaxProbability=clamp(fair-requiredEdge,.01,.99);
 const reduceAtProbability=clamp(fair+.02,.01,.99);
 const entryMinAmericanOdds=fairAmerican(entryMaxProbability);

 const riskFlags:string[]=[];
 if(row.freshness!=='FRESH')riskFlags.push('AGING_PRICE');
 if(row.regime==='DISLOCATED')riskFlags.push('DISLOCATED_REGIME');
 if(row.regime==='VOLATILE')riskFlags.push('VOLATILE_REGIME');
 if(confidence<.55)riskFlags.push('LOW_CONFIDENCE');
 if(row.contextQuality&&row.contextQuality.recommendationReady===false)riskFlags.push('CONTEXT_LIMITED');
 if(venueType==='PREDICTION_EXCHANGE'&&row.bestPredictionVenue?.status==='ILLIQUID')riskFlags.push('THIN_LIQUIDITY');
 if(venueType==='PREDICTION_EXCHANGE'&&row.bestExecutionVenue?.feeAdjusted===false)riskFlags.push('FEES_NOT_NETTED');

 const hardAvoid=
  row.grade==='PASS'||
  row.regime==='DISLOCATED'||
  row.freshness==='STALE'||
  confidence<.45;

 let action:TradeAction;
 if(hardAvoid)action='AVOID';
 else if(edge<=-.025)action='REDUCE';
 else if(edge>=requiredEdge&&expectedValue>0&&row.grade!=='WATCH'){
  action=venueType==='PREDICTION_EXCHANGE'?'BUY':'BET';
 }else if(edge>=.015&&expectedValue>0){
  action='WATCH';
 }else action='HOLD';

 let timing:TradeTiming='WAIT';
 if(action==='REDUCE')timing='EXIT';
 else if(action==='BUY'||action==='BET'){
  if(movement?.steam&&movement.direction==='TOWARD')timing='NOW';
  else if(edge>=.07)timing='NOW';
  else if(movement?.direction==='AWAY')timing='PATIENT';
  else timing='WAIT';
 }

 const edgeScore=clamp(edge/.10)*34;
 const evScore=clamp(expectedValue/.15)*24;
 const confidenceScore=confidence*22;
 const gradeScore=row.grade==='ELITE'?10:row.grade==='STRONG'?7:row.grade==='WATCH'?3:0;
 const movementScore=movement?.steam
  ?movement.direction==='TOWARD'?6:-3
  :0;
 const liquidityScore=venueType==='PREDICTION_EXCHANGE'
  ?(depth>=100000?4:depth>=10000?2:0)
  :4;
 const riskPenalty=riskFlags.length*4;
 const score=Math.round(clamp(edgeScore+evScore+confidenceScore+gradeScore+movementScore+liquidityScore-riskPenalty,0,100));

 const reasons:string[]=[
  `model fair ${(fair*100).toFixed(1)}% vs routed market ${(market*100).toFixed(1)}%`,
  `edge ${edge>=0?'+':''}${(edge*100).toFixed(1)} pts • expected value ${expectedValue>=0?'+':''}${(expectedValue*100).toFixed(1)}%`,
  `dynamic confidence ${(confidence*100).toFixed(1)}% • ${row.grade} • ${row.regime}`
 ];
 if(movement?.steam)reasons.push(`${movement.steamStrength.toLowerCase()} steam ${movement.direction.toLowerCase()} the selection across ${movement.snapshotCount} snapshots`);
 if(action==='BUY'||action==='BET')reasons.push(`entry discipline: require market probability at or below ${(entryMaxProbability*100).toFixed(1)}%`);
 if(action==='REDUCE')reasons.push(`current price is above model fair value; reduce/exit long exposure unless new information changes the model`);

 return {
  action,timing,score,venue,venueType,
  fairProbability:fair,
  marketProbability:market,
  edge,expectedValue,
  entryMaxProbability,
  entryMinAmericanOdds,
  reduceAtProbability,
  confidence,
  reasons,
  riskFlags
 };
}


export type CrossVenueOpportunity={
 grossArbitrage:boolean;
 grossArbitrageMargin:number;
 buyYesVenue?:string;
 buyYesAsk?:number;
 sellYesVenue?:string;
 sellYesBid?:number;
 disagreement:number;
 comparableVenues:number;
};

export function findCrossVenueOpportunity(quotes:Array<{
 source:string;
 probability:number;
 bidProbability?:number;
 askProbability?:number;
 status:string;
}>):CrossVenueOpportunity{
 const usable=quotes.filter(x=>x.status==='MATCHED'||x.status==='UNKNOWN_LIQUIDITY');
 const asks=usable.filter(x=>typeof x.askProbability==='number') as Array<typeof usable[number] & {askProbability:number}>;
 const bids=usable.filter(x=>typeof x.bidProbability==='number') as Array<typeof usable[number] & {bidProbability:number}>;
 const bestAsk=[...asks].sort((a,b)=>a.askProbability-b.askProbability)[0];
 const bestBid=[...bids].sort((a,b)=>b.bidProbability-a.bidProbability)[0];
 let grossArbitrageMargin=0;
 if(bestAsk&&bestBid&&bestAsk.source!==bestBid.source){
  grossArbitrageMargin=Math.max(0,bestBid.bidProbability-bestAsk.askProbability);
 }
 const probs=usable.map(x=>x.probability).filter(Number.isFinite);
 const disagreement=probs.length>=2?Math.max(...probs)-Math.min(...probs):0;
 return {
  grossArbitrage:grossArbitrageMargin>0,
  grossArbitrageMargin,
  buyYesVenue:bestAsk?.source,
  buyYesAsk:bestAsk?.askProbability,
  sellYesVenue:bestBid?.source,
  sellYesBid:bestBid?.bidProbability,
  disagreement,
  comparableVenues:usable.length
 };
}
