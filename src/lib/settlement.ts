export type ResultRecord={modelRunId:number;predicted:number;offeredOdds:number;closingOdds?:number;won:boolean;stake:number};
export function americanToDecimal(odds:number){return odds>0?1+odds/100:1+100/Math.abs(odds)}
export function settle(r:ResultRecord){
 const pnl=r.won?r.stake*(americanToDecimal(r.offeredOdds)-1):-r.stake;
 const offeredImp=1/americanToDecimal(r.offeredOdds);
 const closingImp=r.closingOdds==null?null:1/americanToDecimal(r.closingOdds);
 const clv=closingImp==null?null:closingImp-offeredImp;
 return {...r,pnl,clv};
}
