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
export type PregameEntryPlan={
 status:'ok'|'invalid'|'insufficient_evidence'|'no_edge';
 gameId:string;
 gameStart:string;
 market:EntryPlan;
 projectedLowestWindow:string|null;
 scenarioCount:number;
 warning:string;
};
const validProbability=(x:number|null)=>x===null||(Number.isFinite(x)&&x>=0&&x<=1);
export function planPregameEntries(input:PregameEntryInputs):PregameEntryPlan{
 const warning='RESEARCH ONLY: pregame price dips and execution cannot be guaranteed. A touch does not imply an order fill; independent historical market replay and calibration are required.';
 const market=planInPlayEntries(input);
 const result=(status:PregameEntryPlan['status'],window:string|null=null):PregameEntryPlan=>({
  status,gameId:input.gameId,gameStart:input.gameStart,market,projectedLowestWindow:window,scenarioCount:Array.isArray(input.scenarios)?input.scenarios.length:0,warning
 });
 if(!input.gameId||!Number.isFinite(Date.parse(input.gameStart))||market.status==='invalid'||!Array.isArray(input.scenarios)||
 input.scenarios.some(s=>!s.period||!s.source||!Number.isFinite(s.projectedYesPrice)||s.projectedYesPrice<0||s.projectedYesPrice>1||
 !validProbability(s.touchProbability)||!validProbability(s.fillProbability)||
 (s.fillProbability!==null&&s.touchProbability!==null&&s.fillProbability>s.touchProbability)))return result('invalid');
 if(input.scenarios.length===0)return result('insufficient_evidence');
 // Only a supplied, evidence-backed scenario can identify a projected low window.
 const lowest=input.scenarios.reduce((best,s)=>s.projectedYesPrice<best.projectedYesPrice?s:best);
 return result(market.status==='no_edge'?'no_edge':'ok',lowest.period);
}
