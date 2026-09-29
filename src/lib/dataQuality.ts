import type {Market} from './types';

export type ProviderObservation={
 provider:string;
 marketId:string;
 odds:number;
 pulledAt:string|Date;
 complete:boolean;
 lineupCertainty?:number;
 sourceAgreement?:number;
};

export type QualityResult={
 score:number;
 grade:'TRUSTED'|'USABLE'|'CAUTION'|'SUPPRESS';
 freshness:number;
 completeness:number;
 agreement:number;
 lineupCertainty:number;
 duplicatePenalty:number;
 reasons:string[];
 suppress:boolean;
};

const clamp=(x:number,min=0,max=1)=>Math.max(min,Math.min(max,x));

export function scoreDataQuality(m:Market,observations:ProviderObservation[]=[]):QualityResult{
 const age=Math.max(0,m.sourceAgeMin);
 const freshness=age<=2?1:age<=5?.92:age<=10?.78:age<=20?.58:age<=60?.30:.08;
 const completeness=observations.length?observations.filter(x=>x.complete).length/observations.length:1;
 const prices=observations.map(x=>x.odds).filter(Number.isFinite);
 const spread=prices.length>1?Math.max(...prices)-Math.min(...prices):0;
 const agreement=prices.length<=1?.85:clamp(1-Math.abs(spread)/120);
 const lineupCertainty=observations.length?observations.reduce((s,x)=>s+(x.lineupCertainty??.75),0)/observations.length:.75;
 const unique=new Set(observations.map(x=>x.provider+'|'+x.marketId+'|'+x.odds+'|'+new Date(x.pulledAt).toISOString()));
 const duplicatePenalty=observations.length?clamp(1-unique.size/observations.length):0;
 const score=clamp(.34*freshness+.22*completeness+.22*agreement+.18*lineupCertainty-.12*duplicatePenalty);
 const reasons:string[]=[];
 if(freshness<.5)reasons.push('Source data is aging or stale');
 if(completeness<.8)reasons.push('Provider coverage is incomplete');
 if(agreement<.65)reasons.push('Providers materially disagree');
 if(lineupCertainty<.65)reasons.push('Lineup or availability certainty is low');
 if(duplicatePenalty>.15)reasons.push('Duplicate feed observations detected');
 if(!reasons.length)reasons.push('Fresh, complete, and internally consistent');
 const grade:QualityResult['grade']=score>=.82?'TRUSTED':score>=.68?'USABLE':score>=.5?'CAUTION':'SUPPRESS';
 return {score,grade,freshness,completeness,agreement,lineupCertainty,duplicatePenalty,reasons,suppress:grade==='SUPPRESS'};
}
