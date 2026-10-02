import type {Ranked} from './types';

export type V22Simulation={runs:number;hits:number;probability:number;ciLow:number;ciHigh:number;mode:'event-monte-carlo'|'player-projection'|'probability-fallback'};
export type V22SimulationBundle={summaries:Map<string,V22Simulation>;outcomes:Map<string,Uint8Array>};

const clamp=(x:number,min=0,max=1)=>Math.max(min,Math.min(max,x));
const clean=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

function hashSeed(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h||123456789}
function xorshift32(x:number){x^=x<<13;x^=x>>>17;x^=x<<5;return x|0}
function rng(seed:string){let state=hashSeed(seed);return ()=>{state=xorshift32(state);return (state>>>0)/4294967296}}
function normalPair(next:()=>number){const u1=Math.max(1e-9,next()),u2=Math.max(1e-9,next());const r=Math.sqrt(-2*Math.log(u1));return [r*Math.cos(2*Math.PI*u2),r*Math.sin(2*Math.PI*u2)] as const}
function normalCdf(x:number){
  const t=1/(1+.2316419*Math.abs(x));
  const d=.3989423*Math.exp(-x*x/2);
  let p=1-d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
  if(x<0)p=1-p;
  return p;
}
function invNorm(p:number){
  let lo=-5,hi=5;
  for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(normalCdf(mid)<p)lo=mid;else hi=mid}
  return (lo+hi)/2;
}
function ci(p:number,n:number){const se=Math.sqrt(Math.max(1e-9,p*(1-p)/n));return [Math.max(0,p-1.96*se),Math.min(1,p+1.96*se)] as const}

function sportConfig(sport:string){
  const s=sport.toUpperCase();
  if(s.includes('NFL')||s.includes('NCAAF'))return {kind:'normal',marginSd:13.5,totalSd:12.5,defaultTotal:44};
  if(s.includes('NBA')||s.includes('WNBA')||s.includes('NCAAB'))return {kind:'normal',marginSd:12,totalSd:17,defaultTotal:215};
  if(s.includes('MLB'))return {kind:'poisson',marginSd:3.1,totalSd:3.4,defaultTotal:8.5};
  if(s.includes('NHL'))return {kind:'poisson',marginSd:1.8,totalSd:2.2,defaultTotal:6};
  if(s.includes('SOCCER'))return {kind:'poisson',marginSd:1.35,totalSd:1.55,defaultTotal:2.6};
  return {kind:'normal',marginSd:1.6,totalSd:2,defaultTotal:2};
}

function totalLine(rows:Ranked[],fallback:number){
  const pts=rows.filter(x=>x.market==='Total'&&typeof x.point==='number').map(x=>Math.abs(x.point!));
  if(!pts.length)return fallback;
  pts.sort((a,b)=>a-b);
  return pts[Math.floor(pts.length/2)];
}
function homeWinProb(rows:Ranked[]){
  const home=rows.find(x=>x.market==='Moneyline'&&clean(x.selection).includes(clean(x.home)));
  if(home)return clamp(home.modelProb,.03,.97);
  const away=rows.find(x=>x.market==='Moneyline'&&clean(x.selection).includes(clean(x.away)));
  if(away)return clamp(1-away.modelProb,.03,.97);
  return .5;
}
function selectedSide(m:Ranked){
  const s=clean(m.selection),h=clean(m.home),a=clean(m.away);
  if(h&&s.includes(h))return 'home';
  if(a&&s.includes(a))return 'away';
  return '';
}
function isOver(m:Ranked){return clean(m.selection).startsWith('over')||clean(m.selection).includes(' over ')}
function isUnder(m:Ranked){return clean(m.selection).startsWith('under')||clean(m.selection).includes(' under ')}

function summarizeOutcomes(outcomes:Uint8Array,mode:V22Simulation['mode']):V22Simulation{
  let hits=0;
  for(let i=0;i<outcomes.length;i++)hits+=outcomes[i];
  const runs=outcomes.length;
  const probability=runs?hits/runs:0;
  const [ciLow,ciHigh]=ci(probability,Math.max(1,runs));
  return {runs,hits,probability,ciLow,ciHigh,mode};
}

function bernoulliOutcomes(m:Ranked,runs:number){
  const next=rng(`fallback:${m.id}:${m.startTime}`);
  const p=clamp(m.modelProb,.01,.99);
  const outcomes=new Uint8Array(runs);
  for(let i=0;i<runs;i++)if(next()<p)outcomes[i]=1;
  return outcomes;
}

function playerPropOutcomes(m:Ranked,runs:number,eventZ:number[]):Uint8Array|null{
  if(typeof m.projectionMean!=='number'||typeof m.projectionStdDev!=='number'||typeof m.point!=='number')return null;
  const next=rng(`player:${m.id}:${m.startTime}`);
  const sd=Math.max(.2,m.projectionStdDev);
  const outcomes=new Uint8Array(runs);
  for(let i=0;i<runs;i++){
    const [z]=normalPair(next);
    const value=m.projectionMean+sd*(.24*(eventZ[i]||0)+Math.sqrt(1-.24*.24)*z);
    if((isOver(m)&&value>m.point)||(isUnder(m)&&value<m.point))outcomes[i]=1;
  }
  return outcomes;
}

export function simulateMarketsV22Detailed(rows:Ranked[],runs=10000):V22SimulationBundle{
  const summaries=new Map<string,V22Simulation>();
  const outcomes=new Map<string,Uint8Array>();
  const groups=new Map<string,Ranked[]>();
  for(const row of rows){const k=row.eventId||row.event;groups.set(k,[...(groups.get(k)||[]),row])}

  for(const [eventId,eventRows] of groups){
    const cfg=sportConfig(eventRows[0]?.sport||'');
    const totalMean=totalLine(eventRows,cfg.defaultTotal);
    const pHome=homeWinProb(eventRows);
    const marginMean=cfg.marginSd*invNorm(pHome);
    const next=rng(`event:${eventId}:${eventRows[0]?.startTime||''}`);
    const margins=new Array<number>(runs);
    const totals=new Array<number>(runs);
    const homeScores=new Array<number>(runs);
    const awayScores=new Array<number>(runs);
    const paceZ=new Array<number>(runs);

    for(let i=0;i<runs;i++){
      const [z1,z2]=normalPair(next);
      paceZ[i]=z2;
      if(cfg.kind==='poisson'){
        const meanMargin=Math.max(-totalMean+.2,Math.min(totalMean-.2,marginMean*.6));
        const hMean=Math.max(.1,(totalMean+meanMargin)/2);
        const aMean=Math.max(.1,(totalMean-meanMargin)/2);
        const poisson=(lambda:number)=>{let l=Math.exp(-lambda),k=0,p=1;do{k++;p*=Math.max(1e-9,next())}while(p>l&&k<30);return k-1};
        const hs=poisson(hMean),as=poisson(aMean);
        homeScores[i]=hs;awayScores[i]=as;margins[i]=hs-as;totals[i]=hs+as;
      }else{
        const margin=marginMean+cfg.marginSd*z1;
        const total=Math.max(0,totalMean+cfg.totalSd*(.15*z1+Math.sqrt(1-.15*.15)*z2));
        margins[i]=margin;totals[i]=total;homeScores[i]=Math.max(0,(total+margin)/2);awayScores[i]=Math.max(0,(total-margin)/2);
      }
    }

    for(const m of eventRows){
      let vector:Uint8Array;
      let mode:V22Simulation['mode']='event-monte-carlo';

      if(m.market==='Player Prop'){
        const prop=playerPropOutcomes(m,runs,paceZ);
        if(prop){vector=prop;mode='player-projection'}
        else{vector=bernoulliOutcomes(m,runs);mode='probability-fallback'}
      }else{
        vector=new Uint8Array(runs);
        let handled=true;
        if(m.market==='Moneyline'){
          const side=selectedSide(m);
          for(let i=0;i<runs;i++){
            if(side==='home'&&homeScores[i]>awayScores[i])vector[i]=1;
            else if(side==='away'&&awayScores[i]>homeScores[i])vector[i]=1;
            else if(!side&&clean(m.selection).includes('draw')&&homeScores[i]===awayScores[i])vector[i]=1;
          }
        }else if(m.market==='Spread'&&typeof m.point==='number'){
          const side=selectedSide(m);
          for(let i=0;i<runs;i++){
            if(side==='home'&&margins[i]+m.point>0)vector[i]=1;
            else if(side==='away'&&-margins[i]+m.point>0)vector[i]=1;
          }
        }else if(m.market==='Total'&&typeof m.point==='number'){
          for(let i=0;i<runs;i++)if((isOver(m)&&totals[i]>m.point)||(isUnder(m)&&totals[i]<m.point))vector[i]=1;
        }else handled=false;

        if(!handled){vector=bernoulliOutcomes(m,runs);mode='probability-fallback'}
      }

      outcomes.set(m.id,vector);
      summaries.set(m.id,summarizeOutcomes(vector,mode));
    }
  }
  return {summaries,outcomes};
}

export function simulateMarketsV22(rows:Ranked[],runs=10000){
  return simulateMarketsV22Detailed(rows,runs).summaries;
}
