import type {Market} from './types';
import type {SimulationTier} from './simulation';
import {quantileSummary,type DistributionFamily} from './marketDistributions';

export type MicroProjection={
 homeMean?:number;awayMean?:number;totalMean?:number;marginMean?:number;line?:number;
 unit?:string;distributionFamily?:DistributionFamily;distributionConfidence?:number;
 p10?:number;p50?:number;p90?:number;microUnit?:string;microUnitCount?:number;
};

export type MicroSimulationResult={
 runs:SimulationTier;hits:number;probability:number;ciLow:number;ciHigh:number;
 volatility:number;engine:string;projection:MicroProjection;
};

type Rng={next:()=>number;normal:()=>number};
type Sample={home:number;away:number;units:number;marketTotal?:number};
const clamp=(x:number,min=.001,max=.999)=>Math.max(min,Math.min(max,x));
const unit=(x:number)=>Math.max(-1,Math.min(1,x));
const lower=(s:string)=>s.toLowerCase();
const sport=(m:Market)=>(m.sport||m.league||'').toUpperCase();
const feat=(m:Market,k:string,fallback=0)=>{
 const n=Number(m.sportFeatures?.[k]);
 return Number.isFinite(n)?unit(n):fallback;
};
function hashSeed(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h||123456789}
function xorshift32(x:number){x^=x<<13;x^=x>>>17;x^=x<<5;return x|0}
function seeded(seed:string):Rng{
 let state=hashSeed(seed);
 const next=()=>{state=xorshift32(state);return(state>>>0)/4294967296};
 const normal=()=>{const a=Math.max(1e-12,next()),b=Math.max(1e-12,next());return Math.sqrt(-2*Math.log(a))*Math.cos(2*Math.PI*b)};
 return {next,normal};
}
function actualRuns(runs:SimulationTier):SimulationTier{return runs===100000?10000:runs}
function parseLine(m:Market){
 const xs=[...`${m.market} ${m.selection}`.matchAll(/([+-]?\d+(?:\.\d+)?)/g)].map(x=>Number(x[1])).filter(Number.isFinite);
 return xs.length?xs[xs.length-1]:undefined;
}
function isHome(m:Market){return lower(m.home)!=='home'&&lower(m.selection).includes(lower(m.home))}
function isAway(m:Market){return lower(m.away)!=='away'&&lower(m.selection).includes(lower(m.away))}
function fullGameMarket(m:Market){
 const text=lower(`${m.market} ${m.selection}`);
 return !/(first|1st|second|2nd|third|3rd|fourth|4th|quarter|half|period|inning|set\s+\d|game\s+\d)/.test(text);
}
function kind(m:Market){
 const t=lower(`${m.market} ${m.selection}`);
 if(t.includes('over'))return'OVER';
 if(t.includes('under'))return'UNDER';
 if(t.includes('spread')||t.includes('run line')||t.includes('puck line')||/\s[+-]\d/.test(t))return'SPREAD';
 return'MONEYLINE';
}
function hit(m:Market,sample:Sample){
 const home=sample.home,away=sample.away,k=kind(m),line=parseLine(m),total=sample.marketTotal??home+away;
 const margin=isAway(m)?away-home:isHome(m)?home-away:home-away;
 if(k==='OVER')return line===undefined?undefined:total>Math.abs(line);
 if(k==='UNDER')return line===undefined?undefined:total<Math.abs(line);
 if(k==='SPREAD')return line===undefined?margin>0:margin+line>0;
 if(lower(m.selection).includes('draw'))return home===away;
 if(isAway(m))return away>home;
 if(isHome(m))return home>away;
 return undefined;
}
function homeEdge(m:Market){
 const directional=(kind(m)==='MONEYLINE'||kind(m)==='SPREAD')?(m.modelProb-.5)*2:0;
 const side=isAway(m)?-1:isHome(m)?1:0;
 const scheduleConfidence=Math.max(0,Math.min(1,Number(m.sportFeatures?.scheduleContextConfidence||0)));
 const scheduleEdge=scheduleConfidence>0?feat(m,'scheduleCompositeEdge')*.10*scheduleConfidence:feat(m,'rest')*.05-feat(m,'travel')*.04;
 const venueConfidence=Math.max(0,Math.min(1,Number(m.sportFeatures?.venueWeatherConfidence||0)));
 const venueEdge=venueConfidence>0?feat(m,'venueHomeEdge')*.10*venueConfidence:0;
 return unit(directional*side*.72+feat(m,'home')*.10+feat(m,'efficiency')*.12+feat(m,'form')*.08-feat(m,'injury')*.08+scheduleEdge+venueEdge);
}
function finalize(m:Market,runs:SimulationTier,samples:Sample[],engine:string,scoreUnit:string,family:DistributionFamily,microUnit:string,random:Rng):MicroSimulationResult{
 let hits=0,homeSum=0,awaySum=0,unitSum=0;
 const totals:number[]=[];
 for(const s of samples){
  const h=hit(m,s);
  if(h===true||(h===undefined&&random.next()<clamp(m.modelProb)))hits++;
  homeSum+=s.home;awaySum+=s.away;unitSum+=s.units;totals.push(s.marketTotal??s.home+s.away);
 }
 const n=Math.max(1,samples.length),p=hits/n,se=Math.sqrt(Math.max(1e-9,p*(1-p)/n)),q=quantileSummary(totals);
 return {runs,hits,probability:p,ciLow:Math.max(0,p-1.96*se),ciHigh:Math.min(1,p+1.96*se),volatility:q.stdDev,engine,projection:{
  homeMean:homeSum/n,awayMean:awaySum/n,totalMean:q.mean,marginMean:(homeSum-awaySum)/n,line:parseLine(m),unit:scoreUnit,
  distributionFamily:family,distributionConfidence:.88,p10:q.p10,p50:q.p50,p90:q.p90,microUnit,microUnitCount:unitSum/n
 }};
}

function basketball(m:Market,runs:SimulationTier){
 if(!fullGameMarket(m))return null;
 const s=sport(m);if(!(s.includes('NBA')||s.includes('WNBA')||s.includes('NCAAB')||s.includes('COLLEGE BASKETBALL')))return null;
 const n=actualRuns(runs),rng=seeded(`basketball|${m.id}|${m.startTime}`),edge=homeEdge(m),college=s.includes('NCAAB')||s.includes('COLLEGE BASKETBALL');
 const basePoss=college?70:s.includes('WNBA')?79:99,basePpp=college?1.04:s.includes('WNBA')?1.05:1.13;
 const venueConfidence=Math.max(0,Math.min(1,Number(m.sportFeatures?.venueWeatherConfidence||0)));
 const venuePace=venueConfidence>0?feat(m,'venuePaceEffect')*.08*venueConfidence:0;
 const venueScoring=venueConfidence>0?feat(m,'venueTotalEffect')*.045*venueConfidence:0;
 const pace=Math.max(55,Math.round(basePoss*(1+feat(m,'pace',feat(m,'tempo'))*.08+venuePace))),samples:Sample[]=[];
 const points=(ppp:number)=>{const score=clamp(ppp/2.15,.30,.68);if(rng.next()>score)return 0;const u=rng.next();return u<.09?1:u<.09+clamp(.25+(ppp-1)*.22,.18,.42)?3:2};
 for(let r=0;r<n;r++){let home=0,away=0;const poss=Math.max(50,Math.round(pace+rng.normal()*4));for(let i=0;i<poss;i++){home+=points(basePpp*(1+venueScoring+edge*.075+feat(m,'shooting')*.035));away+=points(basePpp*(1+venueScoring-edge*.075))}samples.push({home,away,units:poss*2})}
 return finalize(m,n,samples,'BASKETBALL_POSSESSION_MONTE_CARLO','points','NORMAL','possessions',rng);
}

function football(m:Market,runs:SimulationTier){
 if(!fullGameMarket(m))return null;
 const s=sport(m);if(!(s.includes('NFL')||s.includes('NCAAF')||s.includes('COLLEGE FOOTBALL')))return null;
 const n=actualRuns(runs),rng=seeded(`football|${m.id}|${m.startTime}`),college=s.includes('NCAAF')||s.includes('COLLEGE FOOTBALL'),edge=homeEdge(m)+feat(m,'quarterback')*.08+feat(m,'trenches')*.05;
 const venueConfidence=Math.max(0,Math.min(1,Number(m.sportFeatures?.venueWeatherConfidence||0)));
 const weather=venueConfidence>0?Math.max(0,-feat(m,'venueTotalEffect'))*venueConfidence:Math.max(0,-feat(m,'weather'));
 const venuePace=venueConfidence>0?feat(m,'venuePaceEffect')*.08*venueConfidence:0;
 const venueVariance=venueConfidence>0?feat(m,'venueVolatilityEffect')*.55*venueConfidence:0;
 const baseDrives=college?12.5:10.8,samples:Sample[]=[];
 const drive=(e:number)=>{const td=clamp(.215+e*.045-weather*.025,.10,.36),fg=clamp(.155+e*.018-weather*.012,.08,.24),u=rng.next();return u<td?(rng.next()<.94?7:6):u<td+fg?3:u<td+fg+.004?2:0};
 for(let r=0;r<n;r++){let home=0,away=0;const drives=Math.max(7,Math.round(baseDrives*(1+feat(m,'tempo')*.08+venuePace)+rng.normal()*(1.25+venueVariance)));for(let d=0;d<drives;d++){home+=drive(edge);away+=drive(-edge)}samples.push({home,away,units:drives*2})}
 return finalize(m,n,samples,'FOOTBALL_DRIVE_MONTE_CARLO','points','NORMAL','drives',rng);
}

type Bases=[boolean,boolean,boolean];
function moveBases(bases:Bases,taken:number){
 let runs=0;const next:Bases=[false,false,false];
 for(let i=2;i>=0;i--)if(bases[i]){const dest=i+taken;if(dest>=3)runs++;else next[dest]=true}
 if(taken>=4)runs++;else next[taken-1]=true;
 return {bases:next,runs};
}
function halfInning(rng:Rng,offense:number,pitching:number){
 let outs=0,runs=0,pa=0;let bases:Bases=[false,false,false];const adv=unit(offense-pitching);
 while(outs<3&&pa<30){pa++;const outP=clamp(.69-adv*.035,.60,.76),walk=.083+adv*.012,single=.145+adv*.018,double=.048+adv*.008,triple=.005,u=rng.next();
  if(u<outP){outs++;continue}
  if(u<outP+walk){if(bases[0]&&bases[1]&&bases[2])runs++;bases=[true,bases[0]||bases[1],bases[1]||bases[2]];continue}
  const taken=u<outP+walk+single?1:u<outP+walk+single+double?2:u<outP+walk+single+double+triple?3:4;
  const moved=moveBases(bases,taken);bases=moved.bases;runs+=moved.runs;
 }
 return {runs,pa};
}
function baseball(m:Market,runs:SimulationTier){
 if(!fullGameMarket(m))return null;
 if(!sport(m).includes('MLB'))return null;
 const n=actualRuns(runs),rng=seeded(`mlb|${m.id}|${m.startTime}`),edge=homeEdge(m),samples:Sample[]=[];
 const venueConfidence=Math.max(0,Math.min(1,Number(m.sportFeatures?.venueWeatherConfidence||0)));
 const conditionOff=venueConfidence>0?feat(m,'venueTotalEffect')*.30*venueConfidence:0;
 const homeOff=edge*.55+feat(m,'lineup')*.22+feat(m,'park')*.06+conditionOff,awayOff=-edge*.55+feat(m,'lineup')*.10+feat(m,'park')*.06+conditionOff,starter=feat(m,'starter')*.35,bullpen=feat(m,'bullpen')*.22;
 for(let r=0;r<n;r++){let home=0,away=0,pa=0;for(let inn=1;inn<=9;inn++){const a=halfInning(rng,awayOff,starter*(inn<=5?1:.2)+bullpen*(inn>5?1:.25)),h=halfInning(rng,homeOff,-starter*(inn<=5?1:.2)-bullpen*(inn>5?1:.25));away+=a.runs;home+=h.runs;pa+=a.pa+h.pa}if(home===away){if(rng.next()<clamp(.5+edge*.08,.36,.64))home++;else away++}samples.push({home,away,units:pa})}
 return finalize(m,n,samples,'MLB_PLATE_APPEARANCE_MONTE_CARLO','runs','POISSON','plate appearances',rng);
}

function hockey(m:Market,runs:SimulationTier){
 if(!fullGameMarket(m))return null;
 if(!sport(m).includes('NHL'))return null;
 const n=actualRuns(runs),rng=seeded(`nhl|${m.id}|${m.startTime}`),edge=homeEdge(m)+feat(m,'goalie')*.08+feat(m,'shotQuality')*.08,samples:Sample[]=[];
 const venueConfidence=Math.max(0,Math.min(1,Number(m.sportFeatures?.venueWeatherConfidence||0)));
 const venuePace=venueConfidence>0?feat(m,'venuePaceEffect')*.08*venueConfidence:0,venueScore=venueConfidence>0?feat(m,'venueTotalEffect')*.025*venueConfidence:0;
 for(let r=0;r<n;r++){let home=0,away=0;const shifts=Math.max(38,Math.round(58*(1+feat(m,'pace')*.10+venuePace)+rng.normal()*5)),hp=clamp(.051+venueScore+edge*.010+feat(m,'specialTeams')*.004,.028,.085),ap=clamp(.051+venueScore-edge*.010,.028,.085);for(let sh=0;sh<shifts;sh++){if(rng.next()<hp)home++;if(rng.next()<ap)away++}if(home===away&&kind(m)==='MONEYLINE'){if(rng.next()<clamp(.5+edge*.10,.35,.65))home++;else away++}samples.push({home,away,units:shifts})}
 return finalize(m,n,samples,'NHL_SHIFT_MONTE_CARLO','goals','POISSON','shifts',rng);
}

function soccer(m:Market,runs:SimulationTier){
 if(!fullGameMarket(m))return null;
 const s=sport(m);if(!(s.includes('SOCCER')||(!s.includes('NFL')&&!s.includes('NCAAF')&&s.includes('FOOTBALL'))))return null;
 const n=actualRuns(runs),rng=seeded(`soccer|${m.id}|${m.startTime}`),edge=homeEdge(m)+feat(m,'xg')*.10+feat(m,'keeper')*.04,samples:Sample[]=[];
 const venueConfidence=Math.max(0,Math.min(1,Number(m.sportFeatures?.venueWeatherConfidence||0)));
 const venuePace=venueConfidence>0?feat(m,'venuePaceEffect')*.10*venueConfidence:0,venueScore=venueConfidence>0?feat(m,'venueTotalEffect')*.018*venueConfidence:0;
 for(let r=0;r<n;r++){let home=0,away=0;const hc=Math.max(4,Math.round(12*(1+edge*.06+venuePace)+rng.normal()*2)),ac=Math.max(4,Math.round(12*(1-edge*.06+venuePace)+rng.normal()*2)),hp=clamp(.108+venueScore+edge*.022+feat(m,'setPieces')*.006,.055,.18),ap=clamp(.108+venueScore-edge*.022,.055,.18);for(let c=0;c<hc;c++)if(rng.next()<hp)home++;for(let c=0;c<ac;c++)if(rng.next()<ap)away++;samples.push({home,away,units:hc+ac})}
 return finalize(m,n,samples,'SOCCER_CHANCE_MONTE_CARLO','goals','POISSON','chances',rng);
}

function tennisGame(rng:Rng,p:number,target:number){
 let a=0,b=0,points=0;while(points<60){points++;if(rng.next()<p)a++;else b++;if((a>=target||b>=target)&&Math.abs(a-b)>=2)break}return {aWon:a>b,points};
}
function tennisSet(rng:Rng,aServe:number,bServe:number){
 let a=0,b=0,points=0,game=0;while(game<20){game++;const aServes=game%2===1,g=tennisGame(rng,aServes?aServe:1-bServe,4);points+=g.points;if(g.aWon)a++;else b++;if((a>=6||b>=6)&&Math.abs(a-b)>=2)break;if(a===6&&b===6){const t=tennisGame(rng,.5+(aServe-bServe)*.6,7);points+=t.points;if(t.aWon)a++;else b++;break}}return{aWon:a>b,points,games:a+b,aGames:a,bGames:b};
}
function tennis(m:Market,runs:SimulationTier){
 if(!fullGameMarket(m))return null;
 const s=sport(m);if(!(s.includes('TENNIS')&&!s.includes('TABLE')))return null;
 const text=lower(`${m.market} ${m.selection}`);
 if(kind(m)==='SPREAD'&&text.includes('game'))return null;
 const n=actualRuns(runs),rng=seeded(`tennis|${m.id}|${m.startTime}`),selectedAway=isAway(m),strength=(m.modelProb-.5)*2*(selectedAway?-1:1),aServe=clamp(.625+strength*.045+feat(m,'serve')*.025+feat(m,'surface')*.012,.52,.76),bServe=clamp(.625-strength*.045+feat(m,'return')*.018,.52,.76),samples:Sample[]=[];
 for(let r=0;r<n;r++){let a=0,b=0,points=0,games=0;while(a<2&&b<2){const s=tennisSet(rng,aServe,bServe);points+=s.points;games+=s.games;if(s.aWon)a++;else b++}const marketTotal=text.includes('point')?points:text.includes('game')?games:a+b;samples.push({home:a,away:b,units:points,marketTotal})}
 const scoreUnit=text.includes('point')?'points':text.includes('game')?'games':'sets';
 return finalize(m,n,samples,'TENNIS_POINT_GAME_SET_MONTE_CARLO',scoreUnit,'BERNOULLI','points',rng);
}

function tableTennis(m:Market,runs:SimulationTier){
 if(!fullGameMarket(m))return null;
 const s=sport(m);if(!(s.includes('TABLE TENNIS')||s.includes('PING PONG')))return null;
 const text=lower(`${m.market} ${m.selection}`);
 if(kind(m)==='SPREAD'&&text.includes('point'))return null;
 const n=actualRuns(runs),rng=seeded(`table-tennis|${m.id}|${m.startTime}`),selectedAway=isAway(m),strength=(m.modelProb-.5)*2*(selectedAway?-1:1)+feat(m,'serve')*.06+feat(m,'return')*.07,p=clamp(.5+strength*.12,.38,.62),samples:Sample[]=[];
 for(let r=0;r<n;r++){let a=0,b=0,points=0;while(a<3&&b<3){const g=tennisGame(rng,p,11);points+=g.points;if(g.aWon)a++;else b++}const marketTotal=text.includes('point')?points:a+b;samples.push({home:a,away:b,units:points,marketTotal})}
 const scoreUnit=text.includes('point')?'points':'games';
 return finalize(m,n,samples,'TABLE_TENNIS_POINT_GAME_MONTE_CARLO',scoreUnit,'BERNOULLI','points',rng);
}

export function runSportMicroSimulation(m:Market,runs:SimulationTier):MicroSimulationResult|null{
 return baseball(m,runs)||football(m,runs)||basketball(m,runs)||hockey(m,runs)||soccer(m,runs)||tableTennis(m,runs)||tennis(m,runs);
}
