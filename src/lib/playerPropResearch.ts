import type {StatGame} from './playerStatQuestions';

export type PlayerPropResearch = {
 status:'insufficient_data'|'ok';
 sampleSize:number;
 observedMean:number|null;
 observedStdDev:number|null;
 projectedMean:number|null;
 estimatedOverProbability:number|null;
 assumptions:string[];
};
/**
 * Exploratory projection, not a calibrated betting probability.
 * Requires at least five observed games and uses an explicitly supplied
 * minutes forecast; never fabricates injury, lineup, or opponent data.
 */
export function researchPlayerProp(games:StatGame[],stat:string,line:number,expectedMinutes?:number,limit=20):PlayerPropResearch {
 const assumptions=['Exploratory estimate only; not calibrated or verified for wagering.',
  'No injury, matchup or roster adjustment without independently verified inputs.'];
 const insufficient=():PlayerPropResearch=>({status:'insufficient_data',sampleSize:0,observedMean:null,observedStdDev:null,projectedMean:null,estimatedOverProbability:null,assumptions});
 if(!Number.isFinite(line)||!Number.isInteger(limit)||limit<5||limit>250)return insufficient();
 const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
 const samples=games.slice(0,limit).flatMap(g=>{
  const match=Object.entries(g.stats||{}).find(([k])=>normalize(k)===normalize(stat));
  const observed=match?number(match[1]):null;
  if(observed===null)return [];
  const minuteEntry=Object.entries(g.stats||{}).find(([k])=>normalize(k)==='minutes');
  return [{observed,minutes:minuteEntry?number(minuteEntry[1]):null}];
 });
 if(samples.length<5)return insufficient();
 const mean=samples.reduce((s,g)=>s+g.observed,0)/samples.length;
 const variance=samples.reduce((s,g)=>s+(g.observed-mean)**2,0)/samples.length;
 const std=Math.sqrt(variance);
 const minuteSamples=samples.filter(g=>g.minutes!==null&&g.minutes>0);
 const avgMinutes=minuteSamples.length>=5?minuteSamples.reduce((s,g)=>s+(g.minutes||0),0)/minuteSamples.length:null;
 const minutesValid=expectedMinutes!==undefined&&Number.isFinite(expectedMinutes)&&expectedMinutes>0&&expectedMinutes<=60;
 const ratio=minutesValid&&avgMinutes!==null?Math.max(.5,Math.min(1.5,expectedMinutes/avgMinutes)):1;
 const projectedMean=mean*ratio;
 if(ratio!==1)assumptions.push('Projected mean scales by expected minutes / observed average minutes, capped at 0.5–1.5.');
 else assumptions.push('No minutes adjustment applied.');
 // No future win probability: historical variance alone cannot establish
 // a reliable predictive distribution or calibration.
 return {status:'ok',sampleSize:samples.length,observedMean:mean,observedStdDev:std,projectedMean,estimatedOverProbability:null,assumptions};
}
