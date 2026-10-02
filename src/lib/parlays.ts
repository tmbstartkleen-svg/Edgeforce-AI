import type {Scanned} from './scanner';
import {decimalOdds,fairAmerican,kelly} from './math';

export type Parlay={
 id:string;
 legs:Scanned[];
 combinedProbability:number;
 independentProbability:number;
 correlationPenalty:number;
 correlationDelta:number;
 jointHits:number;
 jointRuns:number;
 jointMode:'shared-monte-carlo'|'estimated';
 estimatedAmericanOdds:number;
 simFairAmericanOdds:number;
 priceVerified:boolean;
 sportsbookImpliedProbability:number;
 edge:number;
 quarterKelly:number;
 score:number;
 label:string;
};

const norm=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

function correlation(a:Scanned,b:Scanned){
 let c=0;
 const sameEvent=(a.eventId&&b.eventId?a.eventId===b.eventId:a.event===b.event);
 if(sameEvent)c+=.07;
 if(sameEvent&&a.market==='Player Prop'&&b.market==='Player Prop')c+=.05;
 if(sameEvent&&a.market===b.market)c+=.03;
 if(sameEvent&&norm(a.selection).includes(norm(a.home))&&norm(b.selection).includes(norm(b.home)))c+=.04;
 if(a.player&&b.player&&norm(a.player)===norm(b.player))c+=.05;
 if(a.sport===b.sport)c+=.008;
 return Math.min(.20,c);
}

function monteCarloJoint(picks:Scanned[],hitVectors?:Map<string,Uint8Array>){
 if(!hitVectors)return null;
 const vectors=picks.map(x=>hitVectors.get(x.id));
 if(vectors.some(x=>!x))return null;
 const resolved=vectors as Uint8Array[];
 const runs=Math.min(...resolved.map(x=>x.length));
 if(!Number.isFinite(runs)||runs<=0)return null;
 let hits=0;
 for(let i=0;i<runs;i++){
  let all=true;
  for(const vector of resolved)if(vector[i]!==1){all=false;break}
  if(all)hits++;
 }
 return {hits,runs,probability:hits/runs};
}

export function summarizeParlay(picks:Scanned[],label:string,hitVectors?:Map<string,Uint8Array>):Parlay{
 const independent=picks.reduce((p,x)=>p*x.simProbability,1);
 const joint=monteCarloJoint(picks,hitVectors);
 let penalty=0;
 for(let i=0;i<picks.length;i++)for(let j=i+1;j<picks.length;j++)penalty+=correlation(picks[i],picks[j]);
 const cappedPenalty=Math.min(.45,penalty);
 const estimated=Math.max(.000001,Math.min(.999999,independent*(1-cappedPenalty)));
 const adjusted=Math.max(.000001,Math.min(.999999,joint?.probability??estimated));
 const correlationDelta=adjusted-independent;
 const correlationPenalty=Math.max(0,independent-adjusted);
 const decimal=picks.reduce((p,x)=>p*decimalOdds(x.odds),1);
 const sportsbookImpliedProbability=1/decimal;
 const edge=adjusted-sportsbookImpliedProbability;
 const american=fairAmerican(sportsbookImpliedProbability);
 const simFairAmericanOdds=fairAmerican(adjusted);
 const fullKelly=kelly(adjusted,american);
 const quarterKelly=Math.max(0,Math.min(.05,fullKelly*.25));
 const agreement=picks.reduce((s,x)=>s+x.agreement,0)/Math.max(1,picks.length);
 const freshness=picks.reduce((s,x)=>s+(x.freshness==='FRESH'?1:x.freshness==='AGING'?.7:.35),0)/Math.max(1,picks.length);
 const score=adjusted*.58+Math.max(-.15,Math.min(.15,edge))*.25+agreement*.10+freshness*.07;
 return {
  id:picks.map(x=>x.id).join('-'),legs:[...picks],combinedProbability:adjusted,independentProbability:independent,
  correlationPenalty,correlationDelta,jointHits:joint?.hits??Math.round(adjusted*10000),jointRuns:joint?.runs??10000,jointMode:joint?'shared-monte-carlo':'estimated',estimatedAmericanOdds:american,simFairAmericanOdds,priceVerified:false,sportsbookImpliedProbability,edge,quarterKelly,score,label
 };
}

export function buildTopParlays(rows:Scanned[],size:2|3,options:{minJointProbability?:number;minLegProbability?:number;maxResults?:number;maxLegUses?:number;sortBy?:'probability'|'edge';requireDifferentDays?:boolean;hitVectors?:Map<string,Uint8Array>}={}):Parlay[]{
 const minJoint=Math.max(.52,options.minJointProbability??.52);
 const minLeg=Math.max(.65,options.minLegProbability??.65);
 const maxResults=options.maxResults??30;
 const maxLegUses=options.maxLegUses??2;
 const pool=[...rows].filter(x=>x.grade!=='PASS'&&x.simulationMode!=='probability-fallback'&&x.simProbability>=minLeg).sort((a,b)=>b.simProbability-a.simProbability||b.edge-a.edge).slice(0,size===2?80:50);
 const all:Parlay[]=[];
 const visit=(start:number,picks:Scanned[])=>{
  if(picks.length===size){
   if(options.requireDifferentDays){
    const days=new Set(picks.map(x=>new Date(x.startTime).toISOString().slice(0,10)));
    if(days.size<picks.length)return;
   }
   const p=summarizeParlay(picks,size===2?'2-LEG':'3-LEG',options.hitVectors);
   if(p.combinedProbability>=minJoint)all.push(p);
   return;
  }
  for(let i=start;i<pool.length;i++)visit(i+1,[...picks,pool[i]]);
 };
 visit(0,[]);
 all.sort((a,b)=>options.sortBy==='edge'?b.edge-a.edge||b.combinedProbability-a.combinedProbability:b.combinedProbability-a.combinedProbability||b.edge-a.edge);
 const uses=new Map<string,number>(),selected:Parlay[]=[];
 for(const p of all){
  if(p.legs.some(x=>(uses.get(x.id)||0)>=maxLegUses))continue;
  selected.push(p);
  p.legs.forEach(x=>uses.set(x.id,(uses.get(x.id)||0)+1));
  if(selected.length>=maxResults)break;
 }
 return selected;
}

export function buildParlays(rows:Scanned[],size:2|3):Parlay[]{
 return buildTopParlays(rows,size,{minJointProbability:.52,minLegProbability:.65,maxResults:30,maxLegUses:3});
}

export function buildProbabilitySet(rows:Scanned[],size:number):Parlay|null{
 const target=Math.max(2,Math.min(20,Math.round(size)));
 const pool=[...rows].filter(x=>x.grade!=='PASS'&&x.simulationMode!=='probability-fallback'&&x.simProbability>=.65).sort((a,b)=>b.simProbability-a.simProbability||b.agreement-a.agreement).slice(0,60);
 if(pool.length<target)return null;
 const picks:Scanned[]=[];const used=new Set<string>();
 while(picks.length<target){
  let best:Scanned|null=null,bestScore=-Infinity;
  for(const candidate of pool){
   if(used.has(candidate.id))continue;
   const corr=picks.reduce((s,x)=>s+correlation(x,candidate),0);
   const freshness=candidate.freshness==='FRESH'?1:candidate.freshness==='AGING'?.72:.35;
   const localScore=candidate.simProbability*.74+candidate.agreement*.16+freshness*.10-corr*.40;
   if(localScore>bestScore){bestScore=localScore;best=candidate}
  }
  if(!best)break;picks.push(best);used.add(best.id);
 }
 return picks.length===target?summarizeParlay(picks,target+'-LEG PROBABILITY SET'):null;
}

export function buildSportProbabilitySet(rows:Scanned[],sport:string,size:number){return buildProbabilitySet(rows.filter(x=>x.sport===sport),size)}

export function buildMixedSportProbabilitySet(rows:Scanned[],size:number):Parlay|null{
 const target=Math.max(2,Math.min(20,Math.round(size)));
 const bySport=new Map<string,Scanned[]>();
 for(const row of rows.filter(x=>x.grade!=='PASS'&&x.simulationMode!=='probability-fallback'&&x.simProbability>=.65).sort((a,b)=>b.simProbability-a.simProbability))bySport.set(row.sport,[...(bySport.get(row.sport)||[]),row]);
 const sports=[...bySport.keys()];if(!sports.length)return null;
 const seed:Scanned[]=[];let cursor=0;
 while(seed.length<target&&cursor<target*10){const sport=sports[cursor%sports.length],bucket=bySport.get(sport)||[],candidate=bucket.find(x=>!seed.some(s=>s.id===x.id));if(candidate)seed.push(candidate);cursor++;if(seed.length>=rows.length)break}
 if(seed.length<target)return buildProbabilitySet(rows,target);
 return summarizeParlay(seed.slice(0,target),target+'-LEG MULTI-SPORT SET');
}
