import {ev,impliedProbability} from './math';
import type {PredictionContract} from './predictionMarkets';
import type {Scanned} from './scanner';

export type PredictionMarketStatus='MATCHED'|'ILLIQUID'|'UNKNOWN_LIQUIDITY'|'NO_MATCH';

export type PredictionVenueQuote={
 source:string;
 contractId:string;
 title:string;
 probability:number;
 executionProbability:number;
 volume?:number;
 liquidity?:number;
 matchScore:number;
 status:PredictionMarketStatus;
 edge:number;
 expectedValue:number;
};

export type BestExecutionVenue={
 venue:string;
 type:'SPORTSBOOK'|'PREDICTION_EXCHANGE';
 edge:number;
 expectedValue:number;
 marketProbability:number;
 americanOdds?:number;
 contractId?:string;
 matchScore?:number;
 feeAdjusted:boolean;
};

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
 predictionVenueQuotes:PredictionVenueQuote[];
 bestPredictionVenue?:PredictionVenueQuote;
 bestExecutionVenue:BestExecutionVenue;
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

function venueQuotes(row:Scanned,contracts:PredictionContract[],minVolume:number){
 const bestBySource=new Map<string,{contract:PredictionContract;score:number}>();
 for(const contract of contracts){
  const score=contractScore(row,contract);
  if(score<.65)continue;
  const key=contract.source.toLowerCase();
  const prior=bestBySource.get(key);
  const execution=contract.askProbability??contract.yesProbability;
  const priorExecution=prior?.contract.askProbability??prior?.contract.yesProbability??1;
  if(!prior||score>prior.score||(score===prior.score&&execution<priorExecution)){
   bestBySource.set(key,{contract,score});
  }
 }

 const quotes:PredictionVenueQuote[]=[];
 for(const {contract,score} of bestBySource.values()){
  const probability=contract.yesProbability;
  const executionProbability=Math.max(.001,Math.min(.999,contract.askProbability??probability));
  const depth=contract.volume??contract.liquidity;
  const status:PredictionMarketStatus=depth===undefined
   ?'UNKNOWN_LIQUIDITY'
   :depth<minVolume
    ?'ILLIQUID'
    :'MATCHED';
  quotes.push({
   source:contract.source,
   contractId:contract.id,
   title:contract.title,
   probability,
   executionProbability,
   volume:contract.volume,
   liquidity:contract.liquidity,
   matchScore:score,
   status,
   edge:row.simProbability-executionProbability,
   expectedValue:row.simProbability/executionProbability-1
  });
 }
 return quotes.sort((a,b)=>{
  const aRank=a.status==='MATCHED'?2:a.status==='UNKNOWN_LIQUIDITY'?1:0;
  const bRank=b.status==='MATCHED'?2:b.status==='UNKNOWN_LIQUIDITY'?1:0;
  return bRank-aRank||b.expectedValue-a.expectedValue||b.matchScore-a.matchScore;
 });
}

function bestExecution(row:Scanned,quotes:PredictionVenueQuote[]):BestExecutionVenue{
 const bestOdds=row.consensus?.bestOdds??row.odds;
 const bestBook=row.consensus?.bestBook||row.sourceBook||row.consensus?.targetBook||'Sportsbook';
 const sportsbookProbability=impliedProbability(bestOdds);
 const candidates:BestExecutionVenue[]=[{
  venue:bestBook,
  type:'SPORTSBOOK',
  edge:row.simProbability-sportsbookProbability,
  expectedValue:ev(row.simProbability,bestOdds),
  marketProbability:sportsbookProbability,
  americanOdds:bestOdds,
  feeAdjusted:true
 }];

 for(const quote of quotes){
  if(quote.status!=='MATCHED')continue;
  candidates.push({
   venue:quote.source,
   type:'PREDICTION_EXCHANGE',
   edge:quote.edge,
   expectedValue:quote.expectedValue,
   marketProbability:quote.executionProbability,
   contractId:quote.contractId,
   matchScore:quote.matchScore,
   feeAdjusted:false
  });
 }

 return candidates.sort((a,b)=>b.expectedValue-a.expectedValue||b.edge-a.edge)[0];
}

export function fusePredictionMarkets(rows:Scanned[],contracts:PredictionContract[],minVolume=1000):CrossMarketScanned[]{
 return rows.map(row=>{
  const rawImpliedProbability=row.rawImpliedProb??impliedProbability(row.odds);
  const noVigProbability=row.marketProb;
  const sportsbookEdge=row.simProbability-noVigProbability;
  const quarterKelly=Math.min(.05,Math.max(0,row.recommendedStake));
  const predictionVenueQuotes=venueQuotes(row,contracts,minVolume);
  const bestPredictionVenue=predictionVenueQuotes.find(x=>x.status==='MATCHED')
   ||predictionVenueQuotes.find(x=>x.status==='UNKNOWN_LIQUIDITY')
   ||predictionVenueQuotes[0];
  const bestExecutionVenue=bestExecution(row,predictionVenueQuotes);

  if(!bestPredictionVenue){
   return {
    ...row,rawImpliedProbability,noVigProbability,sportsbookEdge,quarterKelly,
    predictionMarketStatus:'NO_MATCH' as const,
    predictionVenueQuotes,
    bestExecutionVenue
   };
  }

  return {
   ...row,
   rawImpliedProbability,
   noVigProbability,
   sportsbookEdge,
   quarterKelly,
   predictionMarketProbability:bestPredictionVenue.executionProbability,
   predictionMarketVolume:bestPredictionVenue.volume,
   predictionMarketSource:bestPredictionVenue.source,
   predictionMarketTitle:bestPredictionVenue.title,
   predictionMarketStatus:bestPredictionVenue.status,
   predictionEdge:bestPredictionVenue.edge,
   predictionVenueQuotes,
   bestPredictionVenue,
   bestExecutionVenue
  };
 });
}
