import type {Scanned} from './scanner';

export type Parlay={id:string;legs:Scanned[];combinedProbability:number;independentProbability:number;correlationPenalty:number;score:number;label:string};

function correlation(a:Scanned,b:Scanned){
 let c=0;
 if(a.event===b.event)c+=.14;
 if(a.selection.includes(a.home)&&b.selection.includes(b.home))c+=.04;
 if(a.sport===b.sport)c+=.015;
 if(a.market==='Player Prop'&&b.market==='Player Prop'&&a.event===b.event)c+=.04;
 return Math.min(.22,c);
}

function summarize(picks:Scanned[],label:string):Parlay{
 const independent=picks.reduce((p,x)=>p*x.simProbability,1);
 let penalty=0;
 for(let i=0;i<picks.length;i++)for(let j=i+1;j<picks.length;j++)penalty+=correlation(picks[i],picks[j]);
 const cappedPenalty=Math.min(.55,penalty);
 const adjusted=Math.max(.000001,Math.min(.999999,independent*(1-cappedPenalty)));
 const agreement=picks.reduce((s,x)=>s+x.agreement,0)/Math.max(1,picks.length);
 const freshness=picks.reduce((s,x)=>s+(x.freshness==='FRESH'?1:x.freshness==='AGING'?.7:.35),0)/Math.max(1,picks.length);
 const score=adjusted*.72+agreement*.18+freshness*.10;
 return {
  id:picks.map(x=>x.id).join('-'),
  legs:[...picks],
  combinedProbability:adjusted,
  independentProbability:independent,
  correlationPenalty:cappedPenalty,
  score,
  label
 };
}

export function buildParlays(rows:Scanned[],size:2|3):Parlay[]{
 const qualified=rows.filter(x=>x.grade==='ELITE'||x.grade==='STRONG').slice(0,16);
 const out:Parlay[]=[];
 const visit=(start:number,picks:Scanned[])=>{
  if(picks.length===size){
   out.push(summarize(picks,size===2?'2-LEG ELITE':'3-LEG ELITE'));
   return;
  }
  for(let i=start;i<qualified.length;i++)visit(i+1,[...picks,qualified[i]]);
 };
 visit(0,[]);
 return out.sort((a,b)=>b.score-a.score).slice(0,10);
}

export function buildProbabilitySet(rows:Scanned[],size:number):Parlay|null{
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

 return picks.length===target?summarize(picks,target+'-LEG PROBABILITY SET'):null;
}

export function buildSportProbabilitySet(rows:Scanned[],sport:string,size:number){
 return buildProbabilitySet(rows.filter(x=>x.sport===sport),size);
}
