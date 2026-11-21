import {planInPlayEntries,type EntryInputs,type EntryPlan} from './inPlayLimitEntryPlanner';

/**
 * Pregame research plan for prospective in-game YES-contract dips.
 * Each scenario must come from a dated game-path / market-replay model;
 * this module does not invent dip probabilities, timing, or order fills.
 */
export type PregameDipScenario={
 period:string;
 projectedYesPrice:number;
 /** Probability that the market trades at or below this level in the window. */
 touchProbability:number|null;
 /** Independently calibrated probability a posted order executes. */
 fillProbability:number|null;
 source:string;
};
export type PregameEntryInputs=Omit<EntryInputs,'calibratedFillByTier'> & {
 gameId:string;
 gameStart:string;
 scenarios:PregameDipScenario[];
};
export type PregameTier={tier:'lower'|'mid'|'high';limitPrice:number;touchProbability:number|null;fillProbability:number|null;period:string;expectedValuePerContract:number;eligible:boolean};
export type PregameEntryPlan={
 status:'ok'|'invalid'|'insufficient_evidence'|'no_edge';
 gameId:string;
 gameStart:string;
 market:EntryPlan;
 projectedLowestWindow:string|null;
 scenarioCount:number;
 scenarioLevels:PregameTier[];
 warning:string;
};
const validProbability=(x:number|null)=>x===null||(Number.isFinite(x)&&x>=0&&x<=1);
export function planPregameEntries(input:PregameEntryInputs):PregameEntryPlan{
 const warning='RESEARCH ONLY: pregame price dips and execution cannot be guaranteed. A touch does not imply an order fill; independent historical market replay and calibration are required.';
 const market=planInPlayEntries(input);
 const result=(status:PregameEntryPlan['status'],window:string|null=null):PregameEntryPlan=>({
  status,gameId:input.gameId,gameStart:input.gameStart,market,projectedLowestWindow:window,scenarioCount:Array.isArray(input.scenarios)?input.scenarios.length:0,scenarioLevels:[],warning
 });
 if(!input.gameId||!Number.isFinite(Date.parse(input.gameStart))||market.status==='invalid'||!Array.isArray(input.scenarios)||
 input.scenarios.some(s=>!s.period||!s.source||!Number.isFinite(s.projectedYesPrice)||s.projectedYesPrice<0||s.projectedYesPrice>1||
 !validProbability(s.touchProbability)||!validProbability(s.fillProbability)||
 (s.fillProbability!==null&&s.touchProbability!==null&&s.fillProbability>s.touchProbability)))return result('invalid');
 if(input.scenarios.length===0)return result('insufficient_evidence');
 // Only a supplied, evidence-backed scenario can identify a projected low window.
 const lowest=input.scenarios.reduce((best,s)=>s.projectedYesPrice<best.projectedYesPrice?s:best);
 // Price tiers are observed scenario quantiles, not arbitrary discounts.
 // A scenario is a possible future dip, never a guaranteed executable quote.
 const sorted=[...input.scenarios].sort((a,b)=>a.projectedYesPrice-b.projectedYesPrice);
 const indices=[0,Math.floor((sorted.length-1)/2),sorted.length-1];
 const scenarioLevels:PregameTier[]=indices.map((index,i)=>{
  const scenario=sorted[index];
  const limitPrice=Math.floor((scenario.projectedYesPrice+1e-10)/input.tickSize)*input.tickSize;
  const ev=input.fairProbability-limitPrice-input.feePerContract;
  return {tier:(['lower','mid','high'] as const)[i],limitPrice:Number(limitPrice.toFixed(6)),
   touchProbability:scenario.touchProbability,fillProbability:scenario.fillProbability,period:scenario.period,
   expectedValuePerContract:Number(ev.toFixed(6)),
   eligible:limitPrice>=input.tickSize&&limitPrice<=input.yesAsk&&ev>=input.minimumEdge};
 });
 return {...result(scenarioLevels.some(x=>x.eligible)?'ok':'no_edge',lowest.period),scenarioLevels};
}
