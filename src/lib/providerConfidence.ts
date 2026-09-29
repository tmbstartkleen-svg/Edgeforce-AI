import {providerHealth,type ProviderState} from './providerRegistry';

export type ProviderConfidenceInput={
 provider:ProviderState;
 historicalClv?:number;
 calibrationError?:number;
 sampleSize?:number;
 marketAgreement?:number;
};

export function providerConfidence(x:ProviderConfidenceInput){
 const health=providerHealth(x.provider).score;
 const clv=Math.max(-.1,Math.min(.1,x.historicalClv??0));
 const clvScore=.5+clv*5;
 const calibration=1-Math.max(0,Math.min(.25,x.calibrationError??.08))*4;
 const sample=Math.min(1,(x.sampleSize??0)/500);
 const agreement=Math.max(0,Math.min(1,x.marketAgreement??.75));
 const score=Math.max(0,Math.min(1,health*.35+clvScore*.2+calibration*.2+sample*.1+agreement*.15));
 return {score,grade:score>=.85?'A':score>=.72?'B':score>=.58?'C':'D',health,clvScore,calibration,sample,agreement};
}
