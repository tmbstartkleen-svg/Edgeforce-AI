import type {Scanned} from './scanner';
import {correlationExposure} from './sameGameCorrelation';
import {runEventJointSimulation,type JointSimulationResult} from './eventJointSimulation';
import type {LearnedSgpMap} from './learnedSgpCorrelation';

export type Parlay={
 id:string;
 legs:Scanned[];
 combinedProbability:number;
 independentProbability:number;
 correlationPenalty:number;
 correlationDelta:number;
 jointSimulationRuns:number;
 jointCi:[number,number];
 eventCount:number;
 sameEventPairCount:number;
 learnedPairCount:number;
 matrixShrink:number;
 jointEngine:JointSimulationResult['engine'];
 scenarioCoverage:number;
 score:number;
 label:string;
 pairCorrelations:JointSimulationResult['pairCorrelations'];
};

function correlation(a:Scanned,b:Scanned){return correlationExposure(a,b)}

function runCount(size:number){
 if(size<=3)return 10000;
 if(size<=6)return 5000;
 if(size<=10)return 3000;
 return 1500;
}

function summarize(picks:Scanned[],label:string,learned?:LearnedSgpMap):Parlay{
 const joint=runEventJointSimulation(picks,learned,runCount(picks.length));
 const independent=joint.independentProbability;
 const adjusted=joint.probability;
 let penalty=0;
 for(let i=0;i<picks.length;i++)for(let j=i+1;j<picks.length;j++)penalty+=correlation(picks[i],picks[j]);
 const cappedPenalty=Math.min(.55,penalty);
 const agreement=picks.reduce((s,x)=>s+x.agreement,0)/Math.max(1,picks.length);
 const freshness=picks.reduce((s,x)=>s+(x.freshness==='FRESH'?1:x.freshness==='AGING'?.7:.35),0)/Math.max(1,picks.length);
 const score=adjusted*.72+agreement*.18+freshness*.10;
 return {
  id:picks.map(x=>x.id).join('-'),
  legs:[...picks],
  combinedProbability:adjusted,
  independentProbability:independent,
  correlationPenalty:cappedPenalty,
  correlationDelta:joint.correlationDelta,
  jointSimulationRuns:joint.runs,
  jointCi:[joint.ciLow,joint.ciHigh],
  eventCount:joint.eventCount,
  sameEventPairCount:joint.pairCorrelations.filter(x=>x.sameEvent).length,
  learnedPairCount:joint.pairCorrelations.filter(x=>x.learnedSample>0).length,
  matrixShrink:joint.matrixShrink,
  jointEngine:joint.engine,
  scenarioCoverage:joint.scenarioCoverage,
  pairCorrelations:joint.pairCorrelations,
  score,
  label
 };
}

export function buildParlays(rows:Scanned[],size:2|3,learned?:LearnedSgpMap):Parlay[]{
 const qualified=rows.filter(x=>x.grade==='ELITE'||x.grade==='STRONG').slice(0,16);
 const out:Parlay[]=[];
 const visit=(start:number,picks:Scanned[])=>{
  if(picks.length===size){
   out.push(summarize(picks,size===2?'2-LEG ELITE':'3-LEG ELITE',learned));
   return;
  }
  for(let i=start;i<qualified.length;i++)visit(i+1,[...picks,qualified[i]]);
 };
 visit(0,[]);
 return out.sort((a,b)=>b.score-a.score).slice(0,10);
}

export function buildProbabilitySet(rows:Scanned[],size:number,learned?:LearnedSgpMap):Parlay|null{
 const target=Math.max(2,Math.min(20,Math.round(size)));
 const pool=[...rows]
  .filter(x=>x.grade!=='PASS')
  .sort((a,b)=>b.simProbability-a.simProbability||b.agreement-a.agreement)
  .slice(0,60);

 if(pool.length<target)return null;

 const picks:Scanned[]=[];
 const used=new Set<string>();

 while(picks.length<target){
  let best:Scanned|null=null;
  let bestScore=-Infinity;

  for(const candidate of pool){
   if(used.has(candidate.id))continue;
   const corr=picks.reduce((s,x)=>s+correlation(x,candidate),0);
   const freshness=candidate.freshness==='FRESH'?1:candidate.freshness==='AGING'?.72:.35;
   const marketPreference=candidate.market.toLowerCase().includes('money')?.025:0;
   const localScore=candidate.simProbability*.72+candidate.agreement*.18+freshness*.10+marketPreference-corr*.35;
   if(localScore>bestScore){bestScore=localScore;best=candidate}
  }

  if(!best)break;
  picks.push(best);
  used.add(best.id);
 }

 return picks.length===target?summarize(picks,target+'-LEG PROBABILITY SET',learned):null;
}

export function buildSportProbabilitySet(rows:Scanned[],sport:string,size:number,learned?:LearnedSgpMap){
 return buildProbabilitySet(rows.filter(x=>x.sport===sport),size,learned);
}

export function buildMixedSportProbabilitySet(rows:Scanned[],size:number,learned?:LearnedSgpMap):Parlay|null{
 const target=Math.max(2,Math.min(20,Math.round(size)));
 const bySport=new Map<string,Scanned[]>();
 for(const row of rows.filter(x=>x.grade!=='PASS').sort((a,b)=>b.simProbability-a.simProbability)){
  bySport.set(row.sport,[...(bySport.get(row.sport)||[]),row]);
 }
 const sports=[...bySport.keys()];
 if(!sports.length)return null;
 const seed:Scanned[]=[];
 let cursor=0;
 while(seed.length<target&&cursor<target*10){
  const sport=sports[cursor%sports.length];
  const bucket=bySport.get(sport)||[];
  const candidate=bucket.find(x=>!seed.some(s=>s.id===x.id));
  if(candidate)seed.push(candidate);
  cursor++;
  if(seed.length>=rows.length)break;
 }
 if(seed.length<target)return buildProbabilitySet(rows,target,learned);
 return summarize(seed.slice(0,target),target+'-LEG MULTI-SPORT SET',learned);
}
