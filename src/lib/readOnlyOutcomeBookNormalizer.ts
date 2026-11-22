/**
 * Strict normalization of externally retrieved, read-only YES/NO order books.
 * These are indicative quotes, not guaranteed fills or executable orders.
 */
export type RawOutcomeBook={yesBids:unknown;noBids:unknown;observedAt:string;marketId:string;sourceUrl:string};
export type NormalizedLevel={price:number;contracts:number};
export type NormalizedOutcomeBook={
 marketId:string;sourceUrl:string;observedAt:string;
 yesBestBid:NormalizedLevel|null;noBestBid:NormalizedLevel|null;
 yesImpliedAsk:NormalizedLevel|null;noImpliedAsk:NormalizedLevel|null;
 status:'valid'|'invalid';reasons:string[];
};
function best(levels:unknown):NormalizedLevel|null{
 if(!Array.isArray(levels))return null;
 let result:NormalizedLevel|null=null;
 for(const level of levels){
  if(!Array.isArray(level)||level.length!==2)return null;
  const [price,contracts]=level;
  if(typeof price!=='number'||typeof contracts!=='number'||
   !Number.isFinite(price)||price<=0||price>=1||
   !Number.isSafeInteger(contracts)||contracts<=0)return null;
  if(!result||price>result.price)result={price,contracts};
 }
 return result;
}
export function normalizeComplementaryBook(raw:RawOutcomeBook):NormalizedOutcomeBook{
 const reasons:string[]=[];
 if(!raw||!raw.marketId||!/^https:\/\//.test(raw.sourceUrl||'')||
  !Number.isFinite(Date.parse(raw.observedAt)))reasons.push('invalid_provenance');
 const yes=best(raw?.yesBids),no=best(raw?.noBids);
 if(!yes||!no)reasons.push('missing_or_invalid_depth');
 const implied=(opposite:NormalizedLevel|null):NormalizedLevel|null=>
  opposite?{price:Math.round((1-opposite.price)*10000)/10000,contracts:opposite.contracts}:null;
 return {marketId:raw?.marketId??'',sourceUrl:raw?.sourceUrl??'',observedAt:raw?.observedAt??'',
  yesBestBid:yes,noBestBid:no,yesImpliedAsk:implied(no),noImpliedAsk:implied(yes),
  status:reasons.length?'invalid':'valid',reasons};
}
