import {compareComplementaryQuotes,type MarketQuoteEvidence} from './readOnlyArbQuoteComparison';

export type FeeAdjustedPair={
 status:'invalid'|'stale'|'unverified'|'insufficient_liquidity'|'not_profitable'|'paper_candidate';
 maxSets:number;netPerSet:number|null;netAtDepth:number|null;totalFeePerSet:number|null;
 warning:string;
};
/**
 * Research-only fee overlay. Fees are explicit USD *per contract* inputs,
 * not assumed from venue labels. Excludes slippage, adverse selection and
 * capital costs. Quotes must already pass matching-rule checks.
 */
export function evaluateFeeAdjustedPair(
 yes:MarketQuoteEvidence,no:MarketQuoteEvidence,nowMs:number,
 yesFeePerContract:number,noFeePerContract:number,maxAgeMs=30000
):FeeAdjustedPair{
 const warning='Paper estimate only: fees are caller supplied, depth is not a confirmed fill, and rule equivalence must be independently verified.';
 if(!Number.isFinite(yesFeePerContract)||yesFeePerContract<0||
  !Number.isFinite(noFeePerContract)||noFeePerContract<0)
  return {status:'invalid',maxSets:0,netPerSet:null,netAtDepth:null,totalFeePerSet:null,warning};
 const base=compareComplementaryQuotes(yes,no,nowMs,maxAgeMs);
 if(base.status!=='candidate'||base.grossProfitPerSet===null)
  return {status:base.status,maxSets:base.maxSets,netPerSet:null,netAtDepth:null,totalFeePerSet:null,warning};
 const totalFeePerSet=yesFeePerContract+noFeePerContract;
 const netPerSet=base.grossProfitPerSet-totalFeePerSet;
 return {status:netPerSet>0?'paper_candidate':'not_profitable',maxSets:base.maxSets,
  netPerSet,netAtDepth:netPerSet*base.maxSets,totalFeePerSet,warning};
}
