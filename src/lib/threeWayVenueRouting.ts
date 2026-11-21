/** Read-only venue routing and double-chance recovery arithmetic. */
export type VenueOffer={venue:'kalshi'|'polymarket_us';outcome:'home'|'draw'|'away';price:number;fee:number;availableContracts:number};
export function routeThreeWayCheapest(offers:VenueOffer[]){
 const outcomes=['home','draw','away'] as const;
 return outcomes.map(outcome=>{
  const options=offers.filter(o=>o.outcome===outcome&&Number.isFinite(o.price)&&o.price>0&&o.price<1&&Number.isFinite(o.fee)&&o.fee>=0&&Number.isSafeInteger(o.availableContracts)&&o.availableContracts>0);
  return options.sort((a,b)=>(a.price+a.fee)-(b.price+b.fee))[0]??null;
 });
}
/** A Home-or-Draw double-chance contract pays zero on an Away result. */
export function doubleChanceRecovery(input:{buyPrice:number;fee:number;contracts:number;winningDays:number}){
 const {buyPrice,fee,contracts,winningDays}=input;
 if(!Number.isFinite(buyPrice)||buyPrice<=0||buyPrice>=1||!Number.isFinite(fee)||fee<0||
 !Number.isSafeInteger(contracts)||contracts<=0||!Number.isSafeInteger(winningDays)||winningDays<0)return null;
 const gainPerWinningDay=contracts*(1-buyPrice-fee);
 const awayUpsetLoss=contracts*(buyPrice+fee);
 return {gainPerWinningDay,awayUpsetLoss,
  breakEvenWinningDays:gainPerWinningDay>0?Math.ceil(awayUpsetLoss/gainPerWinningDay):null,
  profitAfterWinningDays:winningDays*gainPerWinningDay-awayUpsetLoss};
}
