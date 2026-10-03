import type {Market} from './types';

export type DistributionFamily='BERNOULLI'|'POISSON'|'NEGATIVE_BINOMIAL'|'NORMAL'|'GAMMA'|'LOGNORMAL';
export type DistributionSpec={family:DistributionFamily;mean:number;stdDev:number;shape?:number;scale?:number;confidence:number;reason:string};

const lower=(s:string)=>s.toLowerCase();
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

function inferredStd(mean:number,text:string){
 if(/home run|touchdown|goal scorer|steal|block|save made/i.test(text))return Math.max(.35,Math.sqrt(Math.max(.1,mean))*1.15);
 if(/strikeout|assist|rebound|shot|hit|reception|made three/i.test(text))return Math.max(.7,Math.sqrt(Math.max(.1,mean))*1.25);
 if(/passing|rushing|receiving|yard|points|runs|goals|fantasy/i.test(text))return Math.max(1,Math.abs(mean)*.22);
 return Math.max(.5,Math.abs(mean)*.20);
}

export function distributionForMarket(m:Market,mean:number,stdDev?:number):DistributionSpec{
 const text=lower(`${m.sport} ${m.market} ${m.selection} ${m.playerContext?.statKey||''}`);
 const sd=Math.max(.05,Math.abs(stdDev??inferredStd(mean,text)));
 const ratio=mean>0?sd/mean:1;

 if(/anytime touchdown|first touchdown|to score|yes\/no|binary/i.test(text)){
  return {family:'BERNOULLI',mean:clamp(mean,0,1),stdDev:Math.sqrt(clamp(mean,0,1)*(1-clamp(mean,0,1))),confidence:stdDev!==undefined?.9:.72,reason:'binary event market'};
 }

 if(/home run|goal scorer|strikeout|assist|rebound|shot|save|hit|reception|three|steal|block/i.test(text)){
  if(ratio>.55||sd*sd>mean*1.25){
   const variance=Math.max(mean+.01,sd*sd);
   const shape=Math.max(.1,mean*mean/(variance-mean));
   return {family:'NEGATIVE_BINOMIAL',mean,stdDev:sd,shape,confidence:stdDev!==undefined?.94:.78,reason:'overdispersed count statistic'};
  }
  return {family:'POISSON',mean,stdDev:Math.sqrt(Math.max(.05,mean)),confidence:stdDev!==undefined?.92:.76,reason:'count statistic'};
 }

 if(/passing yard|rushing yard|receiving yard|distance|longest|fantasy/i.test(text)){
  const variance=sd*sd;
  const shape=Math.max(.2,mean*mean/Math.max(.01,variance));
  const scale=Math.max(.01,variance/Math.max(.01,mean));
  return {family:'GAMMA',mean,stdDev:sd,shape,scale,confidence:stdDev!==undefined?.93:.77,reason:'positive skew continuous statistic'};
 }

 if(/time|duration|speed|lap|return yards|punt yards/i.test(text)){
  return {family:'LOGNORMAL',mean,stdDev:sd,confidence:stdDev!==undefined?.9:.72,reason:'strictly positive skew statistic'};
 }

 return {family:'NORMAL',mean,stdDev:sd,confidence:stdDev!==undefined?.95:.8,reason:'high-volume continuous statistic'};
}

export function quantileSummary(samples:number[]){
 if(!samples.length)return {p10:0,p50:0,p90:0,mean:0,stdDev:0};
 const sorted=[...samples].sort((a,b)=>a-b);
 const at=(q:number)=>sorted[Math.min(sorted.length-1,Math.max(0,Math.round((sorted.length-1)*q)))];
 const mean=samples.reduce((s,x)=>s+x,0)/samples.length;
 const variance=samples.reduce((s,x)=>s+(x-mean)**2,0)/samples.length;
 return {p10:at(.10),p50:at(.50),p90:at(.90),mean,stdDev:Math.sqrt(variance)};
}
