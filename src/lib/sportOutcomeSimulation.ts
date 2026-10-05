import type {Market} from './types';
import type {SimulationTier,SimulationResult} from './simulation';
import {distributionForMarket,quantileSummary,type DistributionFamily} from './marketDistributions';
import {runSportMicroSimulation} from './sportMicroSimulation';

export type SportOutcomeSimulationResult=SimulationResult & {
 engine:string;
 projection:{
  homeMean?:number;
  awayMean?:number;
  totalMean?:number;
  marginMean?:number;
  selectionMean?:number;
  line?:number;
  unit?:string;
  distributionFamily?:DistributionFamily;
  distributionConfidence?:number;
  p10?:number;
  p50?:number;
  p90?:number;
  microUnit?:string;
  microUnitCount?:number;
 };
};

type Rng={next:()=>number;normal:()=>number};

function poisson(rng:Rng,lambda:number){
 const L=Math.exp(-Math.max(.0001,lambda));
 let k=0,p=1;
 do{k++;p*=Math.max(1e-12,rng.next())}while(p>L&&k<1000);
 return Math.max(0,k-1);
}

function gammaSample(rng:Rng,shape:number,scale:number):number{
 if(shape<1){
  const u=Math.max(1e-12,rng.next());
  return gammaSample(rng,shape+1,scale)*Math.pow(u,1/shape);
 }
 const d=shape-1/3;
 const c=1/Math.sqrt(9*d);
 for(let i=0;i<100;i++){
  const z=rng.normal();
  const v=Math.pow(1+c*z,3);
  if(v<=0)continue;
  const u=rng.next();
  if(u<1-.0331*z**4||Math.log(Math.max(1e-12,u))<.5*z*z+d*(1-v+Math.log(v)))return d*v*scale;
 }
 return shape*scale;
}

function sampleDistribution(rng:Rng,spec:ReturnType<typeof distributionForMarket>){
 if(spec.family==='BERNOULLI')return rng.next()<spec.mean?1:0;
 if(spec.family==='POISSON')return poisson(rng,spec.mean);
 if(spec.family==='NEGATIVE_BINOMIAL'){
  const shape=Math.max(.1,spec.shape||1);
  const scale=Math.max(.0001,spec.mean/shape);
  return poisson(rng,gammaSample(rng,shape,scale));
 }
 if(spec.family==='GAMMA')return gammaSample(rng,Math.max(.1,spec.shape||1),Math.max(.0001,spec.scale||spec.mean));
 if(spec.family==='LOGNORMAL'){
  const variance=spec.stdDev**2;
  const mu=Math.log(Math.max(.0001,spec.mean**2/Math.sqrt(variance+spec.mean**2)));
  const sigma=Math.sqrt(Math.log(1+variance/Math.max(.0001,spec.mean**2)));
  return Math.exp(mu+sigma*rng.normal());
 }
 return spec.mean+spec.stdDev*rng.normal();
}

const clamp=(x:number,min=.001,max=.999)=>Math.max(min,Math.min(max,x));
const feature=(m:Market,k:string,fallback=0)=>{
 const n=Number(m.sportFeatures?.[k]);
 return Number.isFinite(n)?Math.max(-1,Math.min(1,n)):fallback;
};
const rawFeature=(m:Market,k:string)=>{
 const n=Number(m.sportFeatures?.[k]);
 return Number.isFinite(n)?n:undefined;
};
const sport=(m:Market)=>(m.sport||m.league||'').toUpperCase();
const lower=(s:string)=>s.toLowerCase();
function partialMarket(m:Market){
 const text=lower(`${m.market} ${m.selection}`);
 return /(first|1st|second|2nd|third|3rd|fourth|4th|quarter|half|period|inning|set\s+\d|game\s+\d)/.test(text);
}

function seeded(seed:string):Rng{
 let state=hashSeed(seed);
 const next=()=>{state=xorshift32(state);return (state>>>0)/4294967296};
 const normal=()=>{
  const u1=Math.max(1e-12,next()),u2=Math.max(1e-12,next());
  return Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
 };
 return {next,normal};
}

function hashSeed(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h||123456789}
function xorshift32(x:number){x^=x<<13;x^=x>>>17;x^=x<<5;return x|0}

function parseLine(m:Market){
 const text=`${m.market} ${m.selection}`;
 const matches=[...text.matchAll(/([+-]?\d+(?:\.\d+)?)/g)].map(x=>Number(x[1])).filter(Number.isFinite);
 return matches.length?matches[matches.length-1]:undefined;
}

function isHomeSelection(m:Market){
 const s=lower(m.selection);
 return lower(m.home)!=='home'&&s.includes(lower(m.home));
}
function isAwaySelection(m:Market){
 const s=lower(m.selection);
 return lower(m.away)!=='away'&&s.includes(lower(m.away));
}

function marketKind(m:Market){
 const text=lower(`${m.market} ${m.selection}`);
 if(text.includes('over'))return 'OVER';
 if(text.includes('under'))return 'UNDER';
 if(text.includes('spread')||text.includes('run line')||text.includes('puck line')||/\s[+-]\d/.test(text))return 'SPREAD';
 if(text.includes('total'))return 'TOTAL';
 if(text.includes('player')||text.includes('prop'))return 'PROP';
 return 'MONEYLINE';
}

function finalize(runs:SimulationTier,hits:number,engine:string,projection:SportOutcomeSimulationResult['projection'],volatility:number):SportOutcomeSimulationResult{
 const phat=hits/runs;
 const se=Math.sqrt(Math.max(.0000001,phat*(1-phat)/runs));
 return {runs,hits,probability:phat,ciLow:Math.max(0,phat-1.96*se),ciHigh:Math.min(1,phat+1.96*se),volatility,engine,projection};
}

function baselineForTeamSport(m:Market){
 const s=sport(m);
 if(s.includes('MLB'))return {total:8.7,sd:2.7,unit:'runs'};
 if(s.includes('NFL')||s.includes('NCAAF'))return {total:45.5,sd:10.5,unit:'points'};
 if(s.includes('NBA')||s.includes('WNBA')||s.includes('NCAAB'))return {total:s.includes('NCAAB')?145:224,sd:s.includes('NCAAB')?16:19,unit:'points'};
 if(s.includes('NHL'))return {total:6.1,sd:2.0,unit:'goals'};
 if(s.includes('SOCCER')||s.includes('FOOTBALL'))return {total:2.7,sd:1.45,unit:'goals'};
 if(s.includes('RUGBY'))return {total:45,sd:12,unit:'points'};
 if(s.includes('LACROSSE'))return {total:25,sd:5.5,unit:'goals'};
 if(s.includes('CRICKET'))return {total:315,sd:60,unit:'runs'};
 return null;
}

function simulateTeamScoreMarket(m:Market,runs:SimulationTier){
 if(partialMarket(m))return null;
 const base=baselineForTeamSport(m);
 if(!base)return null;
 const rng=seeded(`team|${m.id}|${m.startTime}`);
 const p=clamp(m.modelProb);
 const strength=(p-.5)*2;
 const homeContext=.10*feature(m,'home')+.12*feature(m,'form')+.10*feature(m,'efficiency')-.08*feature(m,'injury')+.08*feature(m,'rest')-.06*feature(m,'travel');
 const weather=.08*feature(m,'weather');
 const totalMean=Math.max(.2,base.total*(1+weather*.12));
 const marginScale=Math.max(1,totalMean*.22);
 const selectionHome=isHomeSelection(m);
 const selectionAway=isAwaySelection(m);
 const directional=selectionAway?-1:selectionHome?1:1;
 const marginMean=(strength+homeContext)*marginScale*directional;
 const homeMean=Math.max(.05,totalMean/2+marginMean/2);
 const awayMean=Math.max(.05,totalMean/2-marginMean/2);
 const kind=marketKind(m);
 const line=parseLine(m);
 const s=sport(m);
 const discreteLowScore=s.includes('MLB')||s.includes('NHL')||s.includes('SOCCER');
 let hits=0;
 const totals:number[]=[];
 for(let i=0;i<runs;i++){
  let home:number,away:number;
  if(discreteLowScore){
   home=poisson(rng,homeMean);
   away=poisson(rng,awayMean);
  }else{
   const common=rng.normal()*base.sd*.24;
   home=Math.max(0,homeMean+common+rng.normal()*base.sd*.48);
   away=Math.max(0,awayMean+common+rng.normal()*base.sd*.48);
  }
  const total=home+away;
  totals.push(total);
  const margin=selectionAway?away-home:home-away;
  let hit=false;
  if(kind==='OVER')hit=line===undefined?rng.next()<p:total>Math.abs(line);
  else if(kind==='UNDER')hit=line===undefined?rng.next()<p:total<Math.abs(line);
  else if(kind==='SPREAD')hit=line===undefined?margin>0:margin+line>0;
  else hit=selectionAway?away>home:selectionHome?home>away:rng.next()<p;
  if(hit)hits++;
 }
 const q=quantileSummary(totals);
 return finalize(runs,hits,discreteLowScore?'DISCRETE_TEAM_SCORE_MONTE_CARLO':'TEAM_SCORE_MONTE_CARLO',{
  homeMean,awayMean,totalMean:q.mean,marginMean,line,unit:base.unit,
  distributionFamily:discreteLowScore?'POISSON':'NORMAL',
  distributionConfidence:.82,
  p10:q.p10,p50:q.p50,p90:q.p90
 },q.stdDev||base.sd);
}
function simulateSetSport(m:Market,runs:SimulationTier){
 if(partialMarket(m))return null;
 const s=sport(m);
 const isSet=s.includes('TENNIS')||s.includes('TABLE TENNIS')||s.includes('VOLLEYBALL');
 if(!isSet)return null;
 const rng=seeded(`set|${m.id}|${m.startTime}`);
 const matchP=clamp(m.modelProb);
 const bestOf=s.includes('VOLLEYBALL')?5:3;
 const target=Math.floor(bestOf/2)+1;
 const setP=clamp(.5+(matchP-.5)*.72);
 const line=parseLine(m);
 let hits=0,totalSets=0;
 for(let i=0;i<runs;i++){
  let a=0,b=0,sets=0;
  while(a<target&&b<target){
   if(rng.next()<setP)a++;else b++;
   sets++;
  }
  totalSets+=sets;
  const selectionAway=isAwaySelection(m);
  const win=selectionAway?b>a:a>b;
  const kind=marketKind(m);
  let hit=win;
  if((kind==='OVER'||kind==='UNDER')&&line!==undefined)hit=kind==='OVER'?sets>Math.abs(line):sets<Math.abs(line);
  if(hit)hits++;
 }
 return finalize(runs,hits,'SET_MATCH_MONTE_CARLO',{totalMean:totalSets/runs,unit:'sets',line},Math.sqrt(setP*(1-setP)));
}

function simulateCombat(m:Market,runs:SimulationTier){
 const s=sport(m);
 if(!(s.includes('UFC')||s.includes('MMA')||s.includes('BOXING')))return null;
 const rng=seeded(`combat|${m.id}|${m.startTime}`);
 const winP=clamp(m.modelProb);
 const finishBias=.5+.18*feature(m,'finishRisk')+.10*feature(m,'striking')+.10*feature(m,'grappling')-.08*feature(m,'cardio');
 const finishP=clamp(finishBias,.15,.85);
 let hits=0,roundSum=0;
 const kind=marketKind(m);
 const line=parseLine(m);
 for(let i=0;i<runs;i++){
  const selectedWins=rng.next()<winP;
  const finish=rng.next()<finishP;
  const round=finish?1+Math.floor(rng.next()*3):3;
  roundSum+=round;
  let hit=selectedWins;
  if((kind==='OVER'||kind==='UNDER')&&line!==undefined)hit=kind==='OVER'?round>Math.abs(line):round<Math.abs(line);
  if(hit)hits++;
 }
 return finalize(runs,hits,'COMBAT_OUTCOME_MONTE_CARLO',{totalMean:roundSum/runs,unit:'rounds',line},Math.sqrt(winP*(1-winP)));
}

function simulateProp(m:Market,runs:SimulationTier){
 if(partialMarket(m))return null;
 const text=lower(`${m.market} ${m.selection}`);
 if(!(text.includes('player')||text.includes('prop')||rawFeature(m,'propMean')!==undefined||rawFeature(m,'projection')!==undefined||m.playerContext?.projection!==undefined))return null;
 const player=m.playerContext;
 const baseMean=player?.projection??rawFeature(m,'propMean')??rawFeature(m,'projection');
 const availability=player?.availability??1;
 const starterScale=player?.starter===false?.72:1;
 const roleConfidence=Math.max(0,Math.min(1,Number(m.sportFeatures?.roleRedistributionConfidence||0)));
 const roleProjectionScale=1+feature(m,'roleStatLift')*.12*roleConfidence+feature(m,'roleUsageLift')*.05*roleConfidence+feature(m,'roleMinutesLift')*.04*roleConfidence;
 const mean=baseMean===undefined?undefined:baseMean*availability*starterScale*Math.max(.75,Math.min(1.30,roleProjectionScale));
 const sd=player?.stdDev??rawFeature(m,'propStd')??rawFeature(m,'projectionStd');
 const line=parseLine(m);
 if(mean===undefined||line===undefined)return null;
 const spec=distributionForMarket(m,mean,sd);
 const rng=seeded(`prop|${m.id}|${m.startTime}|${spec.family}`);
 const direction=text.includes('under')?'UNDER':'OVER';
 let hits=0;
 const samples:number[]=[];
 for(let i=0;i<runs;i++){
  const raw=sampleDistribution(rng,spec);
  const value=Math.max(0,raw);
  samples.push(value);
  const hit=direction==='UNDER'?value<Math.abs(line):value>Math.abs(line);
  if(hit)hits++;
 }
 const q=quantileSummary(samples);
 return finalize(runs,hits,'PLAYER_DISTRIBUTION_MONTE_CARLO',{
  selectionMean:q.mean,
  line:Math.abs(line),
  unit:player?.statKey||'stat',
  distributionFamily:spec.family,
  distributionConfidence:spec.confidence,
  p10:q.p10,p50:q.p50,p90:q.p90
 },q.stdDev);
}

export function runSportOutcomeSimulation(m:Market,runs:SimulationTier,fallback:(m:Market,runs:SimulationTier)=>SimulationResult):SportOutcomeSimulationResult{
 const prop=simulateProp(m,runs);
 if(prop)return prop;
 const micro=runSportMicroSimulation(m,runs);
 if(micro)return micro;
 const team=simulateTeamScoreMarket(m,runs);
 if(team)return team;
 const sets=simulateSetSport(m,runs);
 if(sets)return sets;
 const combat=simulateCombat(m,runs);
 if(combat)return combat;
 const base=fallback(m,runs);
 return {...base,engine:'PROBABILITY_STATE_FALLBACK',projection:{}};
}
