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

export function buildParlays(rows:Scanned[],size:2|3):Parlay[]{
 const qualified=rows.filter(x=>x.grade==='ELITE'||x.grade==='STRONG').slice(0,16);
 const out:Parlay[]=[];
 const visit=(start:number,picks:Scanned[])=>{
  if(picks.length===size){
   const independent=picks.reduce((p,x)=>p*x.simProbability,1);
   let penalty=0;
   for(let i=0;i<picks.length;i++)for(let j=i+1;j<picks.length;j++)penalty+=correlation(picks[i],picks[j]);
   const adjusted=Math.max(.01,Math.min(.99,independent*(1-penalty)));
   const evScore=picks.reduce((s,x)=>s+x.expectedValue,0)/size;
   const agreement=picks.reduce((s,x)=>s+x.agreement,0)/size;
   out.push({id:picks.map(x=>x.id).join('-'),legs:[...picks],combinedProbability:adjusted,independentProbability:independent,correlationPenalty:penalty,score:adjusted*.6+evScore*.25+agreement*.15,label:size===2?'2-LEG ELITE':'3-LEG ELITE'});
   return;
  }
  for(let i=start;i<qualified.length;i++)visit(i+1,[...picks,qualified[i]]);
 };
 visit(0,[]);
 return out.sort((a,b)=>b.score-a.score).slice(0,10);
}
