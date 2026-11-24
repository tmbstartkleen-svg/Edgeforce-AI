import type {StatGame} from './playerStatQuestions';
import {assessVerifiedPlayerContext,pregameHistory,type VerifiedPlayerContext} from './playerPregameContext';
import {simulatePlayerPropResearch,type ExploratoryMonteResult} from './playerPropMonteResearch';

export type ContextualPlayerMonteResult={
 status:'blocked'|'research_only';
 errors:string[];
 simulation:ExploratoryMonteResult|null;
};
/** Only run on pregame history after source and freshness checks.
 * The result remains research-only until separately backtested and calibrated.
 */
export function runContextualPlayerMonte(games:StatGame[],stat:string,line:number,context:VerifiedPlayerContext|null,seed:string):ContextualPlayerMonteResult{
 const assessed=assessVerifiedPlayerContext(context);
 if(!assessed.ready||!context||assessed.expectedMinutes===null)return {status:'blocked',errors:assessed.errors,simulation:null};
 const prior=pregameHistory(games,context.gameTime);
 const simulation=simulatePlayerPropResearch(prior,stat,line,{runs:10000,window:20,expectedMinutes:assessed.expectedMinutes,seed});
 if(simulation.status!=='ok')return {status:'blocked',errors:['Insufficient valid pregame player statistics.'],simulation:null};
 return {status:'research_only',errors:['Simulation is not calibrated for predictive or betting use.'],simulation};
}
