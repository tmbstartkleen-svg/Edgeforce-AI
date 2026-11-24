import type {StatGame} from './playerStatQuestions';
import {researchPlayerProp} from './playerPropResearch';

export type ExploratoryMonteResult={
 status:'ok'|'insufficient_data'|'invalid';
 runs:number;hits:number;pushes:number;
 simulatedOverRate:number|null;
 simulatedUnderRate:number|null;
 mean:number|null;standardDeviation:number|null;
 seed:string;warning:string;
};
function hashSeed(text:string){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h||123456789;}
function nextRandom(state:{value:number}){let x=state.value;x^=x<<13;x^=x>>>17;x^=x<<5;state.value=x;return (x>>>0)/4294967296;}
/** Reproducible bootstrap Monte Carlo using actual game-log observations.
 *  This samples an empirical distribution and is NOT a calibrated predictive model.
 */
export function simulatePlayerPropResearch(games:StatGame[],stat:string,line:number,options:{runs?:number;seed?:string;window?:number;expectedMinutes?:number}={}):ExploratoryMonteResult{
 const runs=options.runs??10000;
 const seed=options.seed??'edgeforce-player-research-v1';
 const warning='UNCALIBRATED: empirical bootstrap, not a forecast or verified betting edge. Injury, opponent and lineup effects are not modeled.';
 const empty=(status:ExploratoryMonteResult['status']):ExploratoryMonteResult=>({status,runs:0,hits:0,pushes:0,simulatedOverRate:null,simulatedUnderRate:null,mean:null,standardDeviation:null,seed,warning});
 if(!Number.isFinite(line)||!Number.isInteger(runs)||runs<100||runs>100000||!Number.isInteger(options.window??20)||typeof seed!=='string'||seed.length>256)return empty('invalid');
 if(options.expectedMinutes!==undefined&&(!Number.isFinite(options.expectedMinutes)||options.expectedMinutes<=0||options.expectedMinutes>60))return empty('invalid');
 const window=options.window??20;
 const research=researchPlayerProp(games,stat,line,options.expectedMinutes,window);
 if(research.status!=='ok'||research.observedMean===null||research.projectedMean===null)return empty('insufficient_data');
 const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 const numeric=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
 const values=games.slice(0,window).flatMap(g=>{
  const found=Object.entries(g.stats||{}).find(([k])=>normalize(k)===normalize(stat));
  const n=found?numeric(found[1]):null;
  return n===null?[]:[n];
 });
 if(values.length<5)return empty('insufficient_data');
 const scale=research.observedMean>0?research.projectedMean/research.observedMean:1;
 const state={value:hashSeed(seed+'|'+stat+'|'+line+'|'+window)};
 let hits=0,under=0,pushes=0;
 for(let i=0;i<runs;i++){
  const sample=values[Math.floor(nextRandom(state)*values.length)]*scale;
  if(Math.abs(sample-line)<1e-9)pushes++;
  else if(sample>line)hits++;
  else under++;
 }
 const decisions=hits+under;
 return {status:'ok',runs,hits,pushes,simulatedOverRate:decisions?hits/decisions:null,simulatedUnderRate:decisions?under/decisions:null,mean:research.projectedMean,standardDeviation:research.observedStdDev===null?null:research.observedStdDev*scale,seed,warning};
}
