/** Cash-adjusted, horizon-aware binary contract comparison.
 * Inputs must be actual BUY/ASK execution prices, NOT last trades or probabilities from unrelated outcomes.
 */
export function comparePredictionContracts({
 yesCents,noCents,contracts=100,yesFeeCents=0,noFeeCents=0,extraFeeCents=0,
 yesAvailable=0,noAvailable=0,expiresAt=null,now=Date.now(),settlementMatched=false
}={}){
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const valid=([yesCents,noCents].every(x=>finite(x)&&x>=0&&x<=100)&&
  [contracts,yesAvailable,noAvailable].every(x=>Number.isInteger(x)&&x>=0&&x<=1e8)&&contracts>0&&
  [yesFeeCents,noFeeCents,extraFeeCents].every(x=>finite(x)&&x>=0&&x<=1e10));
 if(!valid)throw new TypeError('INVALID_BINARY_CONTRACT_INPUT');
 const expiry=expiresAt?Date.parse(expiresAt):null;
 if(expiresAt!==null&&!Number.isFinite(expiry))throw new TypeError('INVALID_EXPIRY');
 const capital=contracts*(yesCents+noCents)/100;
 const fees=(yesFeeCents+noFeeCents+extraFeeCents)/100;
 const cost=capital+fees;
 const payout=contracts;
 const netProfit=payout-cost;
 const netRoiPct=cost>0?100*netProfit/cost:null;
 const maxFills=Math.min(yesAvailable,noAvailable);
 const eligibleSize=contracts<=maxFills;
 const daysUntilResolution=expiry===null?null:Math.max(0,(expiry-now)/86400000);
 // Annualization assumes repeatable reinvestment, which has NOT been verified.
 const illustrativeAnnualizedRoiPct=daysUntilResolution>0&&netRoiPct!==null?
   100*(Math.pow(1+netRoiPct/100,365/daysUntilResolution)-1):null;
 const barriers=[];
 if(!settlementMatched)barriers.push('SETTLEMENT_RULES_NOT_CERTIFIED');
 if(!eligibleSize)barriers.push('INSUFFICIENT_VERIFIED_ASK_LIQUIDITY');
 if(expiry===null)barriers.push('RESOLUTION_DATE_MISSING');
 if(expiry!==null&&expiry<=now)barriers.push('ALREADY_EXPIRED');
 if(netProfit<=0)barriers.push('NO_POSITIVE_NET_SPREAD');
 return {status:barriers.length?'NOT_EXECUTABLE_OR_UNCERTIFIED':'MATHEMATICALLY_POSITIVE_UNVERIFIED_FILLS',
  barriers,contracts,payout,cost,capital,fees,netProfit,netRoiPct,
  grossGapCentsPerPair:100-yesCents-noCents,daysUntilResolution,
  illustrativeAnnualizedRoiPct,eligibleSize,maxFills,
  guaranteedReturnCertified:false,priceFreshnessCertified:false,
  autoExecutionAvailable:false};
}
