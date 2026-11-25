import type {Market} from './types';

export const OBSERVED_ODDS_MAX_AGE_MS=5*60*1000;

export type ObservedSportsbookQuote={
 id:string;
 sport:string;
 league:string;
 event:string;
 selection:string;
 market:string;
 startTime:string;
 odds:number;
 bookmaker:string;
 providerId:string;
 sourceEventId:string;
 quoteObservedAt:string;
 sourceTimestamp?:string;
 evidenceClass:'OBSERVED_REFERENCE';
};

export type ObservedOddsSnapshot={
 referenceCount:number;
 referenceQuotes:ObservedSportsbookQuote[];
 coverage:'PARTIAL';
 recommendationsAuthorized:false;
 maxObservationAgeMs:number;
 withheldObservations?:Array<{identity:string;quoteObservedAt:string}>;
};

type ObservedMarketInput=Pick<Market,'id'|'sport'|'league'|'event'|'selection'|'market'|'startTime'|'odds'|
 'sourceBook'|'sourceProviderId'|'sourceEventId'|'quoteObservedAt'|'sourceTimestamp'|'evidenceClass'>;

function timestamp(value:unknown){
 if(typeof value!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value))return Number.NaN;
 return Date.parse(value);
}

function identity(quote:ObservedSportsbookQuote){
 return JSON.stringify([quote.providerId,quote.bookmaker.toLowerCase(),quote.sport,quote.league,
  quote.sourceEventId,quote.id,quote.market,quote.selection,quote.startTime]);
}

// These observations are display data. The explicit projection intentionally
// omits model probabilities, EV, confidence, stakes and consensus fields.
export function buildObservedOddsSnapshot(markets:ObservedMarketInput[],now=Date.now()):ObservedOddsSnapshot{
 const latest=new Map<string,{quote:ObservedSportsbookQuote;at:number;conflict:boolean}>();
 for(const row of markets){
  if(row.evidenceClass!=='OBSERVED_REFERENCE')continue;
  const observed=timestamp(row.quoteObservedAt),start=timestamp(row.startTime);
  if(!Number.isFinite(observed)||observed>now||now-observed>OBSERVED_ODDS_MAX_AGE_MS)continue;
  if(!Number.isFinite(start)||start<=now)continue;
  if(typeof row.odds!=='number'||!Number.isFinite(row.odds)||Math.abs(row.odds)<100)continue;
  if(!row.id?.trim()||!row.selection?.trim()||!row.sourceBook?.trim()||!row.sourceEventId?.trim()||!row.sourceProviderId?.trim())continue;
  const source=timestamp(row.sourceTimestamp);
  const quote:ObservedSportsbookQuote={
   id:row.id,sport:row.sport,league:row.league,event:row.event,selection:row.selection,
   market:row.market,startTime:row.startTime,odds:row.odds,bookmaker:row.sourceBook,
   providerId:row.sourceProviderId,sourceEventId:row.sourceEventId,
   quoteObservedAt:new Date(observed).toISOString(),evidenceClass:'OBSERVED_REFERENCE',
   ...(Number.isFinite(source)&&source<=observed?{sourceTimestamp:new Date(source).toISOString()}:{})
  };
  const key=identity(quote);
  const previous=latest.get(key);
  if(!previous||observed>previous.at)latest.set(key,{quote,at:observed,conflict:false});
  else if(observed===previous.at&&quote.odds!==previous.quote.odds)previous.conflict=true;
 }
 const referenceQuotes=[...latest.values()].filter(x=>!x.conflict).map(x=>x.quote)
  .sort((a,b)=>Date.parse(a.startTime)-Date.parse(b.startTime)||a.event.localeCompare(b.event)||a.market.localeCompare(b.market)||a.selection.localeCompare(b.selection))
  .slice(0,200);
 const withheldObservations=[...latest].filter(([,value])=>value.conflict)
  .map(([key,value])=>({identity:key,quoteObservedAt:new Date(value.at).toISOString()}));
 return {referenceCount:referenceQuotes.length,referenceQuotes,coverage:'PARTIAL',recommendationsAuthorized:false,
  maxObservationAgeMs:OBSERVED_ODDS_MAX_AGE_MS,withheldObservations};
}

export function mergeObservedOddsSnapshots(snapshots:Array<ObservedOddsSnapshot|null|undefined>,now=Date.now()):ObservedOddsSnapshot{
 const result=buildObservedOddsSnapshot(snapshots.flatMap(snapshot=>(snapshot?.referenceQuotes||[]).map(quote=>({
  ...quote,sourceBook:quote.bookmaker,sourceProviderId:quote.providerId
 }))),now);
 // Retain newer conflict evidence across cached snapshots so a withheld update
 // cannot resurrect an older, individually valid quote from another path.
 const withheld=new Map<string,number>();
 for(const row of [...snapshots.flatMap(snapshot=>snapshot?.withheldObservations||[]),...(result.withheldObservations||[])]){
  const at=timestamp(row.quoteObservedAt);
  if(Number.isFinite(at)&&at<=now&&now-at<=OBSERVED_ODDS_MAX_AGE_MS&&at>(withheld.get(row.identity)??-Infinity))withheld.set(row.identity,at);
 }
 const referenceQuotes=result.referenceQuotes.filter(quote=>{
  const key=identity(quote),at=timestamp(quote.quoteObservedAt),blocked=withheld.get(key);
  if(blocked!==undefined&&blocked>=at)return false;
  withheld.delete(key);
  return true;
 });
 return {...result,referenceCount:referenceQuotes.length,referenceQuotes,
  withheldObservations:[...withheld].map(([key,at])=>({identity:key,quoteObservedAt:new Date(at).toISOString()}))};
}
