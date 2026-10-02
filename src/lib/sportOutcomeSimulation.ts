import type {Market} from './types';
import type {SimulationTier,SimulationResult} from './simulation';

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
 };
};

type Rng={next:()=>number;normal:()=>number};

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
 let hits=0;
 for(let i=0;i<runs;i++){
  const common=rng.normal()*base.sd*.24;
  const home=Math.max(0,homeMean+common+rng.normal()*base.sd*.48);
  const away=Math.max(0,awayMean+common+rng.normal()*base.sd*.48);
  const total=home+away;
  const margin=selectionAway?away-home:home-away;
  let hit=false;
  if(kind==='OVER')hit=line===undefined?rng.next()<p:total>Math.abs(line);
  else if(kind==='UNDER')hit=line===undefined?rng.next()<p:total<Math.abs(line);
  else if(kind==='SPREAD')hit=line===undefined?margin>0:margin+line>0;
  else hit=selectionAway?away>home:selectionHome?home>away:rng.next()<p;
  if(hit)hits++;
 }
 return finalize(runs,hits,'TEAM_SCORE_MONTE_CARLO',{homeMean,awayMean,totalMean,marginMean,line,unit:base.unit},base.sd);
}

function simulateSetSport(m:Market,runs:SimulationTier){
 const s=sport(m);
 const isSet=s.includes('TENNIS')||s.includes('TABLE TENNIS')||s.includes('VOLLEYBALL');
 if(!isSet)return null;
 const rng=seeded(`set|${m.id}|${m.startTime}`);
 const matchP=clamp(m.modelProb);
 const bestOf=s.includes('VOLLEYBALL')?5:3;
 const target=Math.floor(bestOf/2)+1;
 const setP=clamp(.5+(matchP-.5)*.72);
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
  const line=parseLine(m);
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
 if(marketKind(m)!=='PROP')return null;
 const mean=rawFeature(m,'propMean')??rawFeature(m,'projection');
 const sd=rawFeature(m,'propStd')??rawFeature(m,'projectionStd');
 const line=parseLine(m);
 if(mean===undefined||line===undefined)return null;
 const sigma=Math.max(.1,Math.abs(sd??mean*.18));
 const rng=seeded(`prop|${m.id}|${m.startTime}`);
 const kind=marketKind(m);
 let hits=0;
 for(let i=0;i<runs;i++){
  const value=Math.max(0,mean+rng.normal()*sigma);
  const hit=kind==='UNDER'?value<Math.abs(line):value>Math.abs(line);
  if(hit)hits++;
 }
 return finalize(runs,hits,'PLAYER_STAT_MONTE_CARLO',{selectionMean:mean,line:Math.abs(line),unit:'stat'},sigma);
}

export function runSportOutcomeSimulation(m:Market,runs:SimulationTier,fallback:(m:Market,runs:SimulationTier)=>SimulationResult):SportOutcomeSimulationResult{
 const prop=simulateProp(m,runs);
 if(prop)return prop;
 const team=simulateTeamScoreMarket(m,runs);
 if(team)return team;
 const sets=simulateSetSport(m,runs);
 if(sets)return sets;
 const combat=simulateCombat(m,runs);
 if(combat)return combat;
 const base=fallback(m,runs);
 return {...base,engine:'PROBABILITY_STATE_FALLBACK',projection:{}};
}
