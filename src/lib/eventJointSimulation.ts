import type {LearnedSgpMap} from './learnedSgpCorrelation';
import {learnedSgpProfile} from './learnedSgpCorrelation';
import {sameGameCorrelation,type CorrelationLeg} from './sameGameCorrelation';

export type JointSimulationLeg=CorrelationLeg & {
 startTime:string;
 simProbability:number;
};

export type PairCorrelation={
 a:string;
 b:string;
 sameEvent:boolean;
 heuristic:number;
 learned:number;
 learnedSample:number;
 learnedConfidence:number;
 blended:number;
};

export type JointSimulationResult={
 runs:number;
 hits:number;
 probability:number;
 independentProbability:number;
 correlationDelta:number;
 ciLow:number;
 ciHigh:number;
 pairCorrelations:PairCorrelation[];
 matrixShrink:number;
 eventCount:number;
};

const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));

function eventKey(x:JointSimulationLeg){
 return [x.sport,x.event,x.startTime].join('|').toLowerCase();
}

function blendedCorrelation(a:JointSimulationLeg,b:JointSimulationLeg,learned?:LearnedSgpMap):PairCorrelation{
 const sameEvent=eventKey(a)===eventKey(b);
 if(!sameEvent)return {a:a.id,b:b.id,sameEvent:false,heuristic:0,learned:0,learnedSample:0,learnedConfidence:0,blended:0};
 const heuristic=sameGameCorrelation(a,b);
 const profile=learnedSgpProfile(learned,a.sport,a.market,b.market);
 const learnedRho=profile?.learnedRho??0;
 const confidence=profile?.confidence??0;
 const blendWeight=Math.min(.80,confidence*.80);
 const blended=clamp(heuristic*(1-blendWeight)+learnedRho*blendWeight,-.55,.55);
 return {
  a:a.id,b:b.id,sameEvent:true,heuristic,learned:learnedRho,
  learnedSample:profile?.sampleSize??0,learnedConfidence:confidence,blended
 };
}

function cholesky(matrix:number[][]){
 const n=matrix.length;
 const L=Array.from({length:n},()=>Array(n).fill(0));
 for(let i=0;i<n;i++){
  for(let j=0;j<=i;j++){
   let sum=matrix[i][j];
   for(let k=0;k<j;k++)sum-=L[i][k]*L[j][k];
   if(i===j){
    if(sum<=1e-8)return null;
    L[i][j]=Math.sqrt(sum);
   }else{
    if(Math.abs(L[j][j])<1e-10)return null;
    L[i][j]=sum/L[j][j];
   }
  }
 }
 return L;
}

function stableCholesky(base:number[][]){
 let shrink=1;
 for(let attempt=0;attempt<16;attempt++){
  const matrix=base.map((row,i)=>row.map((v,j)=>i===j?1:v*shrink));
  const L=cholesky(matrix);
  if(L)return {L,shrink};
  shrink*=.82;
 }
 return {L:base.map((row,i)=>row.map((_,j)=>i===j?1:0)),shrink:0};
}

function hashSeed(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h||123456789}
function xorshift32(x:number){x^=x<<13;x^=x>>>17;x^=x<<5;return x|0}
function rng(seed:string){
 let state=hashSeed(seed);
 const next=()=>{state=xorshift32(state);return (state>>>0)/4294967296};
 const normal=()=>{
  const u1=Math.max(1e-12,next()),u2=Math.max(1e-12,next());
  return Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
 };
 return {normal};
}

function invNorm(p:number){
 const x=clamp(p,1e-8,1-1e-8);
 const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924];
 const b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857];
 const c=[-.00778489400243029,-.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878];
 const d=[.00778469570904146,.32246712907004,2.445134137143,3.75440866190742];
 const plow=.02425,phigh=1-plow;
 if(x<plow){
  const q=Math.sqrt(-2*Math.log(x));
  return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
 }
 if(x>phigh){
  const q=Math.sqrt(-2*Math.log(1-x));
  return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
 }
 const q=x-.5,r=q*q;
 return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

export function runEventJointSimulation(legs:JointSimulationLeg[],learned?:LearnedSgpMap,runs=10000):JointSimulationResult{
 const n=legs.length;
 if(!n)return {runs:0,hits:0,probability:0,independentProbability:0,correlationDelta:0,ciLow:0,ciHigh:0,pairCorrelations:[],matrixShrink:1,eventCount:0};
 const independent=legs.reduce((p,x)=>p*clamp(x.simProbability,.001,.999),1);
 if(n===1){
  const p=clamp(legs[0].simProbability,.001,.999);
  return {runs,hits:Math.round(p*runs),probability:p,independentProbability:p,correlationDelta:0,ciLow:p,ciHigh:p,pairCorrelations:[],matrixShrink:1,eventCount:1};
 }
 const matrix=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
 const pairCorrelations:PairCorrelation[]=[];
 for(let i=0;i<n;i++){
  for(let j=i+1;j<n;j++){
   const pair=blendedCorrelation(legs[i],legs[j],learned);
   matrix[i][j]=matrix[j][i]=pair.blended;
   pairCorrelations.push(pair);
  }
 }
 const {L,shrink}=stableCholesky(matrix);
 const thresholds=legs.map(x=>invNorm(clamp(x.simProbability,.001,.999)));
 const random=rng('joint|'+legs.map(x=>x.id).join('|')+'|'+legs.map(x=>x.startTime).join('|'));
 let hits=0;
 for(let run=0;run<runs;run++){
  const z=Array.from({length:n},()=>random.normal());
  const y=Array(n).fill(0);
  for(let i=0;i<n;i++)for(let k=0;k<=i;k++)y[i]+=L[i][k]*z[k];
  if(y.every((value,i)=>value<=thresholds[i]))hits++;
 }
 const p=hits/runs;
 const se=Math.sqrt(Math.max(1e-10,p*(1-p)/runs));
 return {
  runs,hits,probability:p,independentProbability:independent,
  correlationDelta:p-independent,
  ciLow:Math.max(0,p-1.96*se),ciHigh:Math.min(1,p+1.96*se),
  pairCorrelations,matrixShrink:shrink,
  eventCount:new Set(legs.map(eventKey)).size
 };
}
