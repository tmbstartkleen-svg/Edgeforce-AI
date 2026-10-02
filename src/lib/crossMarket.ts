import {impliedProbability,kelly} from './math';
import type {PredictionContract} from './predictionMarkets';
import type {Scanned} from './scanner';

export type PredictionMarketStatus='MATCHED'|'ILLIQUID'|'UNKNOWN_LIQUIDITY'|'NO_MATCH';

export type CrossMarketScanned=Scanned & {
 rawImpliedProbability:number;
 noVigProbability:number;
 sportsbookEdge:number;
 quarterKelly:number;
 predictionMarketProbability?:number;
 predictionMarketVolume?:number;
 predictionMarketSource?:string;
 predictionMarketTitle?:string;
 predictionMarketStatus:PredictionMarketStatus;
 predictionEdge?:number;
};

const STOP=new Set(['the','a','an','at','vs','v','to','win','wins','will','game','match','market','moneyline','ml']);

function normalize(value:string){
 return value.toLowerCase().replace(/[^a-z0-9.+-]+/g,' ').replace(/\s+/g,' ').trim();
}

function tokens(value:string){
 return normalize(value).split(' ').filter(x=>x&&x.length>1&&!STOP.has(x));
}

function phraseIn(haystack:string,needle:string){
 const h=normalize(haystack);
 const n=normalize(needle);
 return Boolean(n&&h.includes(n));
}

function marketCompatible(row:Scanned,contract:PredictionContract){
 const title=normalize(contract.title);
 const market=normalize(row.market);
 const selection=normalize(row.selection);
 const isTotal=/total|over|under/.test(market)||/^(over|under)\b/.test(selection);
 const isSpread=/spread|puckline|run line|runline|handicap/.test(market)||/[+-]\d/.test(selection);
 if(isTotal)return /over|under|total/.test(title);
 if(isSpread)return /spread|cover|handicap|[+-]\d/.test(title);
 return !/over|under|total|spread|cover|handicap/.test(title);
}

function contractScore(row:Scanned,contract:PredictionContract){
 if(!marketCompatible(row,contract))return 0;
 const title=contract.title;
 const selectionTokens=tokens(row.selection);
 const matchedSelection=selectionTokens.length&&selectionTokens.every(t=>normalize(title).includes(t));
 let score=matchedSelection?.55:0;
 if(phraseIn(title,row.home))score+=.15;
 if(phraseIn(title,row.away))score+=.15;
 if(phraseIn(title,row.selection))score+=.15;
 const eventTokens=tokens(row.event);
 const eventOverlap=eventTokens.length?eventTokens.filter(t=>normalize(title).includes(t)).length/eventTokens.length:0;
 score+=Math.min(.15,eventOverlap*.15);
 return Math.min(1,score);
}

function bestContract(row:Scanned,contracts:PredictionContract[]){
 let best:{contract:PredictionContract;score:number}|undefined;
 for(const contract of contracts){
  const score=contractScore(row,contract);
  if(score<.65)continue;
  if(!best||score>best.score)best={contract,score};
 }
 return best;
}

export function fusePredictionMarkets(rows:Scanned[],contracts:PredictionContract[],minVolume=1000):CrossMarketScanned[]{
 return rows.map(row=>{
  const rawImpliedProbability=row.rawImpliedProb??impliedProbability(row.odds);
  const noVigProbability=row.marketProb;
  const sportsbookEdge=row.simProbability-noVigProbability;
  const quarterKelly=Math.min(.05,kelly(row.simProbability,row.odds)*.25);
  const match=bestContract(row,contracts);
  if(!match){
   return {...row,rawImpliedProbability,noVigProbability,sportsbookEdge,quarterKelly,predictionMarketStatus:'NO_MATCH' as const};
  }
  const c=match.contract;
  const volume=c.volume;
  const base={
   ...row,
   rawImpliedProbability,
   noVigProbability,
   sportsbookEdge,
   quarterKelly,
   predictionMarketProbability:c.yesProbability,
   predictionMarketVolume:volume,
   predictionMarketSource:c.source,
   predictionMarketTitle:c.title
  };
  if(volume===undefined){
   return {...base,predictionMarketStatus:'UNKNOWN_LIQUIDITY' as const};
  }
  if(volume<minVolume){
   return {...base,predictionMarketStatus:'ILLIQUID' as const};
  }
  return {
   ...base,
   predictionMarketStatus:'MATCHED' as const,
   predictionEdge:row.simProbability-c.yesProbability
  };
 });
}
