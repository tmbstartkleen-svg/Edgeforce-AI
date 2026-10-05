import type {CorrelationLeg} from './sameGameCorrelation';

export type EventStateLeg=CorrelationLeg & {
 home?:string; away?:string; modelProb?:number; sportFeatures?:Record<string,number>;
 playerContext?:{name:string;team?:string;projection?:number;stdDev?:number;availability?:number;starter?:boolean;statKey?:string};
};

export type EventStatePair={a:string;b:string;rho:number;jointRate:number;aRate:number;bRate:number};
export type EventStateResult={supported:boolean;engine:'SHARED_EVENT_STATE';runs:number;hits:number;probability:number;ciLow:number;ciHigh:number;pairCorrelations:EventStatePair[];coverage:number;reason?:string};

type Rng={next:()=>number;normal:()=>number};
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
const lower=(s:string)=>s.toLowerCase();
function hashSeed(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h||123456789}
function xorshift32(x:number){x^=x<<13;x^=x>>>17;x^=x<<5;return x|0}
function rng(seed:string):Rng{let state=hashSeed(seed);const next=()=>{state=xorshift32(state);return (state>>>0)/4294967296};const normal=()=>{const u1=Math.max(1e-12,next()),u2=Math.max(1e-12,next());return Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2)};return {next,normal}}
function poisson(random:Rng,lambda:number){const L=Math.exp(-Math.max(.0001,lambda));let k=0,p=1;do{k++;p*=Math.max(1e-12,random.next())}while(p>L&&k<1000);return Math.max(0,k-1)}

function baseline(sport:string){
 const s=sport.toUpperCase();
 if(s.includes('MLB'))return {total:8.7,sd:2.7,unit:'runs',discrete:true};
 if(s.includes('NFL')||s.includes('NCAAF'))return {total:45.5,sd:10.5,unit:'points',discrete:false};
 if(s.includes('NBA')||s.includes('WNBA')||s.includes('NCAAB'))return {total:s.includes('NCAAB')?145:224,sd:s.includes('NCAAB')?16:19,unit:'points',discrete:false};
 if(s.includes('NHL'))return {total:6.1,sd:2,unit:'goals',discrete:true};
 if(s.includes('SOCCER')||s.includes('FOOTBALL'))return {total:2.7,sd:1.45,unit:'goals',discrete:true};
 if(s.includes('RUGBY'))return {total:45,sd:12,unit:'points',discrete:false};
 if(s.includes('LACROSSE'))return {total:25,sd:5.5,unit:'goals',discrete:false};
 return null;
}

function parseLine(leg:EventStateLeg){const text=`${leg.market} ${leg.selection}`;const m=[...text.matchAll(/([+-]?\d+(?:\.\d+)?)/g)].map(x=>Number(x[1])).filter(Number.isFinite);return m.length?m[m.length-1]:undefined}
function isPlayer(leg:EventStateLeg){return Boolean(leg.playerContext)||lower(leg.market).includes('player')||lower(leg.market).includes('prop')}
function kind(leg:EventStateLeg){const t=lower(`${leg.market} ${leg.selection}`);if(t.includes('over'))return 'OVER';if(t.includes('under'))return 'UNDER';if(t.includes('spread')||t.includes('run line')||t.includes('puck line')||/\s[+-]\d/.test(t))return 'SPREAD';if(t.includes('total'))return 'TOTAL';return 'MONEYLINE'}
function mentions(text:string,name?:string){return Boolean(name&&name.length>1&&lower(text).includes(lower(name)))}

function eventKey(x:EventStateLeg){return [x.sport,x.event,x.startTime||''].join('|').toLowerCase()}

export function runSharedEventStateSimulation(legs:EventStateLeg[],runs=10000):EventStateResult|null{
 if(legs.length<2)return null;
 if(new Set(legs.map(eventKey)).size!==1)return null;
 const base=baseline(legs[0].sport);
 if(!base)return null;
 const home=legs.find(x=>x.home)?.home;
 const away=legs.find(x=>x.away)?.away;
 const unsupported=legs.filter(x=>{
  if(isPlayer(x))return !(x.playerContext&&Number.isFinite(Number(x.playerContext.projection))&&parseLine(x)!==undefined);
  const k=kind(x); return !['OVER','UNDER','TOTAL','SPREAD','MONEYLINE'].includes(k);
 });
 if(unsupported.length)return null;

 const random=rng('event-state|'+eventKey(legs[0])+'|'+legs.map(x=>`${x.id}:${x.market}:${x.selection}`).join('|'));
 const hitCounts=Array(legs.length).fill(0);
 const pairHits=Array.from({length:legs.length},()=>Array(legs.length).fill(0));
 let jointHits=0;

 const homeEvidence=legs.filter(x=>mentions(`${x.market} ${x.selection}`,home)&&!isPlayer(x)).map(x=>x.modelProb??x.simProbability);
 const awayEvidence=legs.filter(x=>mentions(`${x.market} ${x.selection}`,away)&&!isPlayer(x)).map(x=>x.modelProb??x.simProbability);
 const avg=(a:number[])=>a.length?a.reduce((s,x)=>s+x,0)/a.length:.5;
 const homeStrength=clamp(avg(homeEvidence)-avg(awayEvidence),-.35,.35);
 const injurySignals=legs.map(x=>Number(x.sportFeatures?.injury||0)).filter(Number.isFinite);
 const injuryShock=injurySignals.length?clamp(injurySignals.reduce((s,x)=>s+Math.abs(x),0)/injurySignals.length,0,1):0;
 const scheduleEdges=legs.map(x=>Number(x.sportFeatures?.scheduleCompositeEdge)).filter(Number.isFinite);
 const scheduleConfidences=legs.map(x=>Number(x.sportFeatures?.scheduleContextConfidence)).filter(Number.isFinite);
 const scheduleConfidence=scheduleConfidences.length?clamp(scheduleConfidences.reduce((s,x)=>s+x,0)/scheduleConfidences.length,0,1):0;
 const scheduleEdge=scheduleEdges.length?clamp(scheduleEdges.reduce((s,x)=>s+x,0)/scheduleEdges.length,-1,1)*scheduleConfidence:0;
 const fatigueValues=legs.flatMap(x=>[Number(x.sportFeatures?.scheduleHomeFatigue),Number(x.sportFeatures?.scheduleAwayFatigue)]).filter(Number.isFinite);
 const scheduleFatigue=fatigueValues.length?clamp(fatigueValues.reduce((s,x)=>s+x,0)/fatigueValues.length,0,1):0;
 const venueConfidences=legs.map(x=>Number(x.sportFeatures?.venueWeatherConfidence)).filter(Number.isFinite);
 const venueConfidence=venueConfidences.length?clamp(venueConfidences.reduce((s,x)=>s+x,0)/venueConfidences.length,0,1):0;
 const venueTotals=legs.map(x=>Number(x.sportFeatures?.venueTotalEffect)).filter(Number.isFinite);
 const venueHomes=legs.map(x=>Number(x.sportFeatures?.venueHomeEdge)).filter(Number.isFinite);
 const venueVols=legs.map(x=>Number(x.sportFeatures?.venueVolatilityEffect)).filter(Number.isFinite);
 const venueTotal=venueTotals.length?clamp(venueTotals.reduce((s,x)=>s+x,0)/venueTotals.length,-1,1)*venueConfidence:0;
 const venueHome=venueHomes.length?clamp(venueHomes.reduce((s,x)=>s+x,0)/venueHomes.length,-1,1)*venueConfidence:0;
 const venueVolatility=venueVols.length?clamp(venueVols.reduce((s,x)=>s+x,0)/venueVols.length,0,1)*venueConfidence:0;
 const injuryTotalScale=1-.035*injuryShock;
 const fatigueTotalScale=1-.025*scheduleFatigue*scheduleConfidence;
 const venueTotalScale=1+venueTotal*.08;
 const scheduleMargin=base.total*.055*scheduleEdge;
 const venueMargin=base.total*.045*venueHome;
 const homeMean0=Math.max(.05,(base.total/2+homeStrength*base.total*.28+scheduleMargin+venueMargin)*injuryTotalScale*fatigueTotalScale*venueTotalScale);
 const awayMean0=Math.max(.05,(base.total-(base.total/2+homeStrength*base.total*.28)-scheduleMargin-venueMargin)*injuryTotalScale*fatigueTotalScale*venueTotalScale);

 for(let r=0;r<runs;r++){
  const paceZ=random.normal();
  const homeFormZ=random.normal();
  const awayFormZ=random.normal();
  const paceScale=Math.exp(paceZ*(.07+.025*injuryShock+.015*scheduleFatigue*scheduleConfidence+.020*venueVolatility));
  const homeMean=Math.max(.01,homeMean0*paceScale*Math.exp(homeFormZ*.05));
  const awayMean=Math.max(.01,awayMean0*paceScale*Math.exp(awayFormZ*.05));
  const homeScore=base.discrete?poisson(random,homeMean):Math.max(0,homeMean+base.sd*(.26*paceZ+.42*homeFormZ+.36*random.normal()));
  const awayScore=base.discrete?poisson(random,awayMean):Math.max(0,awayMean+base.sd*(.26*paceZ+.42*awayFormZ+.36*random.normal()));
  const total=homeScore+awayScore;
  const legHits:boolean[]=[];

  for(let i=0;i<legs.length;i++){
   const leg=legs[i],k=kind(leg),line=parseLine(leg);
   let hit=false;
   if(isPlayer(leg)){
    const p=leg.playerContext!;
    const teamHome=mentions(p.team||'',home);
    const teamAway=mentions(p.team||'',away);
    const legScheduleConfidence=Math.max(0,Math.min(1,Number(leg.sportFeatures?.scheduleContextConfidence||0)));
    const teamFatigue=teamHome?Number(leg.sportFeatures?.scheduleHomeFatigue||0):teamAway?Number(leg.sportFeatures?.scheduleAwayFatigue||0):0;
    const playerScheduleScale=1-teamFatigue*.045*legScheduleConfidence+(teamHome?1:teamAway?-1:0)*Number(leg.sportFeatures?.scheduleCompositeEdge||0)*.025*legScheduleConfidence;
    const legVenueConfidence=Math.max(0,Math.min(1,Number(leg.sportFeatures?.venueWeatherConfidence||0)));
    const playerVenueScale=1+Number(leg.sportFeatures?.venueTotalEffect||0)*.035*legVenueConfidence+(teamHome?1:teamAway?-1:0)*Number(leg.sportFeatures?.venueHomeEdge||0)*.02*legVenueConfidence;
    const mean=Number(p.projection)*(p.availability??1)*(p.starter===false?.72:1)*Math.max(.88,Math.min(1.08,playerScheduleScale))*Math.max(.90,Math.min(1.10,playerVenueScale));
    const sd=Math.max(.1,Math.abs(Number(p.stdDev??mean*.18)))*(1+Math.max(0,Number(leg.sportFeatures?.venueVolatilityEffect||0))*.12*legVenueConfidence);
    const teamZ=teamHome?homeFormZ:teamAway?awayFormZ:(homeFormZ+awayFormZ)/2;
    const eventScale=Math.exp(.08*paceZ+.07*teamZ);
    const value=Math.max(0,mean*eventScale+sd*.72*random.normal());
    hit=k==='UNDER'?value<Math.abs(line!):value>Math.abs(line!);
   }else if(k==='OVER')hit=line===undefined?random.next()<(leg.simProbability||.5):total>Math.abs(line);
   else if(k==='UNDER')hit=line===undefined?random.next()<(leg.simProbability||.5):total<Math.abs(line);
   else {
    const selectionHome=mentions(leg.selection,home);
    const selectionAway=mentions(leg.selection,away);
    const margin=selectionAway?awayScore-homeScore:homeScore-awayScore;
    if(k==='SPREAD')hit=line===undefined?margin>0:margin+line>0;
    else hit=selectionAway?awayScore>homeScore:selectionHome?homeScore>awayScore:random.next()<(leg.simProbability||.5);
   }
   legHits.push(hit);
   if(hit)hitCounts[i]++;
  }
  for(let i=0;i<legs.length;i++)for(let j=i+1;j<legs.length;j++)if(legHits[i]&&legHits[j])pairHits[i][j]++;
  if(legHits.every(Boolean))jointHits++;
 }

 const pairCorrelations:EventStatePair[]=[];
 for(let i=0;i<legs.length;i++){
  for(let j=i+1;j<legs.length;j++){
   const pA=hitCounts[i]/runs,pB=hitCounts[j]/runs,pAB=pairHits[i][j]/runs;
   const denom=Math.sqrt(Math.max(1e-12,pA*(1-pA)*pB*(1-pB)));
   const rho=denom>0?(pAB-pA*pB)/denom:0;
   pairCorrelations.push({a:legs[i].id,b:legs[j].id,rho:clamp(rho,-.95,.95),jointRate:pAB,aRate:pA,bRate:pB});
  }
 }
 const probability=jointHits/runs;
 const se=Math.sqrt(Math.max(1e-10,probability*(1-probability)/runs));
 return {supported:true,engine:'SHARED_EVENT_STATE',runs,hits:jointHits,probability,ciLow:Math.max(0,probability-1.96*se),ciHigh:Math.min(1,probability+1.96*se),pairCorrelations,coverage:1};
}
