import {planPregameEntries,type PregameEntryInputs,type PregameEntryPlan,type PregameDipScenario} from './pregameMarketEntryPlanner';

/**
 * Converts externally simulated game paths to evidence-gated price scenarios.
 * Only accepts market-price paths produced by an independently validated
 * game-state-to-market-price model; game win rates alone are insufficient.
 */
export type MarketPath={
 simulationId:string;
 modelVersion:string;
 modelValidated:boolean;
 marketReplayValidated:boolean;
 source:string;
 points:{period:string;yesPrice:number}[];
};
export type MarketPathPlanInputs=Omit<PregameEntryInputs,'scenarios'> & {
 paths:MarketPath[];
 minimumPaths:number;
};
export function planFromSimulatedMarketPaths(input:MarketPathPlanInputs):PregameEntryPlan{
 const {paths,minimumPaths,...market}=input;
 const noEvidence=()=>planPregameEntries({...market,scenarios:[]});
 if(!Array.isArray(paths)||!Number.isInteger(minimumPaths)||minimumPaths<100||
  paths.length<minimumPaths||paths.some(path=>!path.simulationId||!path.modelVersion||
   !path.modelValidated||!path.marketReplayValidated||!path.source||
   !Array.isArray(path.points)||path.points.length===0||
   path.points.some(p=>!p.period||!Number.isFinite(p.yesPrice)||p.yesPrice<0||p.yesPrice>1)))return noEvidence();
 const unique=new Set(paths.map(p=>p.simulationId));
 if(unique.size!==paths.length||new Set(paths.map(p=>p.modelVersion)).size!==1)return noEvidence();
 // Each path contributes one minimum, preventing long paths from receiving
 // disproportionate weight. A low touch probability is NOT an order fill rate.
 const minima=paths.map(p=>p.points.reduce((a,b)=>a.yesPrice<=b.yesPrice?a:b));
 const sorted=[...minima].sort((a,b)=>a.yesPrice-b.yesPrice);
 const quantiles=[0.1,0.5,0.9];
 const scenarios:PregameDipScenario[]=quantiles.map(q=>{
  const item=sorted[Math.min(sorted.length-1,Math.floor(q*(sorted.length-1)))];
  const touches=minima.filter(p=>p.yesPrice<=item.yesPrice).length/minima.length;
  return {period:item.period,projectedYesPrice:item.yesPrice,touchProbability:touches,
   fillProbability:null,source:`validated market-path replay: ${paths[0].modelVersion}`};
 });
 return planPregameEntries({...market,scenarios});
}
