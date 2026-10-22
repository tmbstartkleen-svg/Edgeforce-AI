/** First-party market research math. No vendor data, fetches, or claims of executable odds. */
export type TwoWayQuote={side:'A'|'B';americanOdds:number;source:string;observedAt:string;availableStake?:number};
export type ArbLeg={side:'A'|'B';americanOdds:number;maxStake:number;source:string;observedAt:string;rulesKey:string};
const decimal=(odds:number)=>{if(!Number.isInteger(odds)||Math.abs(odds)<100)throw new RangeError('INVALID_AMERICAN_ODDS');return odds>0?1+odds/100:1+100/-odds};
const validTime=(value:string,now:number,maxAgeMs:number)=>{const time=Date.parse(value);return Number.isFinite(time)&&time<=now&&now-time<=maxAgeMs};
export function twoWayFairPrice(a:number,b:number){
 const rawA=1/decimal(a),rawB=1/decimal(b),sum=rawA+rawB;
 return {overround:sum-1,fairA:rawA/sum,fairB:rawB/sum,method:'PROPORTIONAL_DEVIG_ESTIMATE' as const};
}
/** Exact opposite outcomes and identical settlement rules must be proven by caller. */
export function evaluateTwoWayArbitrage(legs:ArbLeg[],nowIso:string,maxAgeMs=60000){
 const now=Date.parse(nowIso);
 if(!Number.isFinite(now)||!Number.isInteger(maxAgeMs)||maxAgeMs<1)throw new RangeError('INVALID_TIME');
 const reasons:string[]=[];
 if(legs.length!==2||new Set(legs.map(x=>x.side)).size!==2)reasons.push('NOT_COMPLEMENTARY');
 if(legs.some(x=>!x.rulesKey||!x.source||!Number.isFinite(x.maxStake)||x.maxStake<=0))reasons.push('MISSING_LIQUIDITY_OR_RULES');
 if(new Set(legs.map(x=>x.rulesKey)).size!==1)reasons.push('SETTLEMENT_RULE_MISMATCH');
 if(legs.some(x=>!validTime(x.observedAt,now,maxAgeMs)))reasons.push('STALE_QUOTE');
 let stakeA=0,stakeB=0,roi=null as number|null;
 try{
  const [a,b]=legs.map(x=>decimal(x.americanOdds));
  const inverse=1/a+1/b;
  if(inverse>=1)reasons.push('NO_GROSS_ARBITRAGE');
  if(!reasons.length){
   const total=Math.min(legs[0].maxStake*a,legs[1].maxStake*b)*inverse;
   stakeA=total/(inverse*a);stakeB=total/(inverse*b);
   roi=1/inverse-1;
  }
 }catch{reasons.push('INVALID_ODDS')}
 return {status:reasons.length?'RESEARCH_ONLY':'GROSS_ARBITRAGE',reasons,stakeA,stakeB,grossRoi:roi,netRoi:null as number|null,
  warning:'Net profit unverified: fees, taxes, slippage, market suspension, currency and actual accepted stakes not modeled.'};
}
export type ExchangeLevel={price:number;contracts:number};
/** Ask depth is the cost to buy YES; no last-price shortcuts. */
export function executableExchangeYesCost(asks:ExchangeLevel[],contracts:number,feePerContract=0){
 if(!Number.isSafeInteger(contracts)||contracts<=0||!Number.isFinite(feePerContract)||feePerContract<0)throw new RangeError('INVALID_ORDER');
 let remaining=contracts,cost=0;
 for(const level of [...asks].sort((a,b)=>a.price-b.price)){
  if(!Number.isFinite(level.price)||level.price<=0||level.price>=1||!Number.isSafeInteger(level.contracts)||level.contracts<0)throw new RangeError('INVALID_DEPTH');
  const fill=Math.min(remaining,level.contracts);cost+=fill*(level.price+feePerContract);remaining-=fill;
  if(!remaining)break;
 }
 if(remaining)return {executable:false,cost:null,averageCost:null,unfilled:remaining};
 return {executable:true,cost,averageCost:cost/contracts,unfilled:0};
}
