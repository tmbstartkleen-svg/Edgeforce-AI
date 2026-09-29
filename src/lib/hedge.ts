export type HedgeInput={
 bankroll:number;
 currentExposure:number;
 hedgeOdds:number;
 hedgeWinProbability:number;
 targetLossPct:number;
};

const decimal=(odds:number)=>odds>0?1+odds/100:1+100/Math.abs(odds);

export function hedgeSizing(x:HedgeInput){
 const maxLoss=x.bankroll*Math.max(0,x.targetLossPct);
 const excess=Math.max(0,x.currentExposure-maxLoss);
 if(excess<=0)return {stake:0,reason:'Exposure already within target'};
 const profitPerDollar=decimal(x.hedgeOdds)-1;
 const raw=profitPerDollar>0?excess/profitPerDollar:0;
 const confidenceScale=Math.max(.25,Math.min(1,x.hedgeWinProbability/.5));
 const stake=Math.min(x.bankroll*.05,raw*confidenceScale);
 return {stake,reason:stake>0?'Sized to reduce downside without over-hedging':'No efficient hedge'};
}
