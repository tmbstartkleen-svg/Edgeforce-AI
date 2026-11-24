/**
 * Research-only in-play limit entry planner for binary YES contracts.
 * Prices are dollars per $1 payout. No orders, live quotes, or calibrated fill
 * probabilities are created here. Input data must come from verified sources.
 */
export type EntryStrategy='fixed'|'adaptive';
export type EntryTier='lower'|'mid'|'high';
export type EntryInputs={
 platform:'kalshi'|'polymarket';
 marketId:string;
 asOf:string;
 yesBid:number;
 yesAsk:number;
 fairProbability:number;
 tickSize:number;
 feePerContract:number;
 minimumEdge:number;
 strategy:EntryStrategy;
 targetFillProbability:0.6|0.8|0.95;
 /** Observed conditional fill probabilities from historical order-book replay. */
 calibratedFillByTier?:Partial<Record<EntryTier,number>>;
 /** A fixed strategy can retain the initial quoted ask from when it was armed. */
 referenceAsk?:number;
};
export type EntryLevel={
 tier:EntryTier;
 limitPrice:number;
 expectedValuePerContract:number;
 edgePercentagePoints:number;
 estimatedFillProbability:number|null;
 meetsTargetFill:boolean|null;
 eligible:boolean;
};
export type EntryPlan={
 status:'ok'|'invalid'|'no_edge';
 platform:EntryInputs['platform'];
 marketId:string;
 strategy:EntryStrategy;
 targetFillProbability:number;
 levels:EntryLevel[];
 warning:string;
};
const tiers:EntryTier[]=['lower','mid','high'];
const finite=(x:number)=>Number.isFinite(x);
const within=(x:number,min:number,max:number)=>finite(x)&&x>=min&&x<=max;
const roundDown=(price:number,tick:number)=>Math.floor((price+1e-10)/tick)*tick;
export function planInPlayEntries(input:EntryInputs):EntryPlan{
 const warning='RESEARCH ONLY: no live market connection, no guaranteed fill, no calibrated win or fill probability unless independently validated. Limit orders may fill before adverse price moves.';
 const empty=(status:EntryPlan['status']):EntryPlan=>({status,platform:input.platform,marketId:input.marketId,strategy:input.strategy,targetFillProbability:input.targetFillProbability,levels:[],warning});
 if(!input.marketId||!Number.isFinite(Date.parse(input.asOf))||
  !within(input.yesBid,0,1)||!within(input.yesAsk,0,1)||input.yesBid>input.yesAsk||
  !within(input.fairProbability,0,1)||!within(input.feePerContract,0,1)||
  !within(input.minimumEdge,0,1)||!within(input.tickSize,0.0001,0.5)||
  !['fixed','adaptive'].includes(input.strategy)||
  ![0.6,0.8,0.95].includes(input.targetFillProbability)||
  (input.referenceAsk!==undefined&&!within(input.referenceAsk,0,1))||
  (input.calibratedFillByTier!==undefined&&Object.values(input.calibratedFillByTier).some(v=>v!==undefined&&!within(v,0,1))))return empty('invalid');
 const anchor=input.strategy==='fixed'?(input.referenceAsk??input.yesAsk):input.yesAsk;
 // Tier discounts are research heuristics, not inferred price lows or fill probabilities.
 const discounts=[0.15,0.08,0.02];
 const maxPositivePrice=input.fairProbability-input.feePerContract-input.minimumEdge;
 const levels=tiers.map((tier,i)=>{
  const candidate=Math.min(anchor*(1-discounts[i]),maxPositivePrice);
  const price=Math.max(0,Math.min(1,roundDown(candidate,input.tickSize)));
  const valid=price>=input.tickSize&&price<=input.yesAsk;
  const ev=input.fairProbability-price-input.feePerContract;
  const fill=input.calibratedFillByTier?.[tier]??null;
  return {tier,limitPrice:Number(price.toFixed(6)),expectedValuePerContract:Number(ev.toFixed(6)),edgePercentagePoints:Number(((input.fairProbability-price)*100).toFixed(3)),estimatedFillProbability:fill,meetsTargetFill:fill===null?null:fill>=input.targetFillProbability,eligible:valid&&ev>=input.minimumEdge};
 });
 return {status:levels.some(x=>x.eligible)?'ok':'no_edge',platform:input.platform,marketId:input.marketId,strategy:input.strategy,targetFillProbability:input.targetFillProbability,levels,warning};
}
