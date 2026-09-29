export type CashoutInput={
 stake:number;
 originalOdds:number;
 currentWinProbability:number;
 cashoutOffer:number;
 hedgeCost?:number;
};

const decimal=(odds:number)=>odds>0?1+odds/100:1+100/Math.abs(odds);

export function cashoutDecision(x:CashoutInput){
 const grossIfWin=x.stake*decimal(x.originalOdds);
 const holdValue=x.currentWinProbability*grossIfWin;
 const hedgeCost=x.hedgeCost||0;
 const adjustedHold=Math.max(0,holdValue-hedgeCost);
 const edge=x.cashoutOffer-adjustedHold;
 const decision=edge>Math.max(1,x.stake*.01)?'CASH_OUT':edge< -Math.max(1,x.stake*.01)?'HOLD':'NEUTRAL';
 return {grossIfWin,holdValue,adjustedHold,cashoutOffer:x.cashoutOffer,cashoutEdge:edge,decision};
}
