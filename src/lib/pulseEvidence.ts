/** Evidence from a partial public price tape, never a normalized betting market. */
export type ValidatedPulseRow={
 sport:string;
 fixture:string;
 market:string;
 status:'OPEN';
 inplay:boolean;
 updatedAt:string;
 sourceAgeMs:number;
 prices:{selectionId:string;american:number}[];
};

export type PulseEvidence={
 fresh:boolean;
 ageMs:number|null;
 usable:boolean;
 priceCount:number;
 rowCount:number;
 rows:ValidatedPulseRow[];
 rejectedRows:number;
 rejectedPrices:number;
 reason:string|null;
};

const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const timestamp=(value:unknown)=>typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)?Date.parse(value):NaN;
const maximumAgeMs=120000;

export function isPulseAmericanPrice(value:unknown):value is number{
 return typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)>=100;
}

export function evaluatePulseEvidence(value:unknown,now=Date.now()):PulseEvidence{
 const pulse=object(value),observed=timestamp(pulse.generatedAt);
 const validTime=Number.isFinite(now)&&Number.isFinite(observed)&&observed<=now;
 const ageMs=validTime?now-observed:null;
 const fresh=pulse.ok===true&&pulse.fresh!==false&&ageMs!==null&&ageMs<=maximumAgeMs;
 const rawRows=Array.isArray(pulse.rows)?pulse.rows:[];
 const rows:ValidatedPulseRow[]=[];
 let rejectedRows=0,rejectedPrices=0;
 for(const value of rawRows){
  const row=object(value),updatedAt=text(row.updatedAt),updated=timestamp(updatedAt);
  const rawPrices=Array.isArray(row.prices)?row.prices:[];
  const prices=rawPrices.flatMap(value=>{
   const price=object(value),selectionId=text(price.selectionId);
   if(!selectionId||!isPulseAmericanPrice(price.american)){rejectedPrices++;return []}
   return [{selectionId,american:price.american}];
  });
  if(!fresh||row.status!=='OPEN'||!Number.isFinite(updated)||updated>now||now-updated>maximumAgeMs||
   !text(row.fixture)||!text(row.market)||!prices.length){rejectedRows++;continue}
  rows.push({sport:text(row.sport)||'Unspecified sport',fixture:text(row.fixture),market:text(row.market),
   status:'OPEN',inplay:row.inplay===true,updatedAt,sourceAgeMs:now-updated,prices});
 }
 const priceCount=rows.reduce((sum,row)=>sum+row.prices.length,0);
 const reason=!validTime?'SNAPSHOT_TIME_UNVERIFIED':pulse.ok!==true?'SOURCE_UNAVAILABLE':
  pulse.fresh===false?'SOURCE_MARKED_STALE':ageMs!==null&&ageMs>maximumAgeMs?'SNAPSHOT_STALE':
  !priceCount?'NO_CURRENT_OPEN_PRICES':null;
 return {fresh,ageMs,usable:fresh&&priceCount>0,priceCount,rowCount:rows.length,rows,rejectedRows,rejectedPrices,reason};
}
