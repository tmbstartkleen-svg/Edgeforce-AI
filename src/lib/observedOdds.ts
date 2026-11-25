import type {Market} from './types';

export const OBSERVED_ODDS_MAX_AGE_MS=5*60*1000;
export const OBSERVED_ODDS_MAX_QUOTES=1000;

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
 coverageDetails?:{
  eligibleQuoteCount:number;
  returnedQuoteCount:number;
  omittedQuoteCount:number;
  upstreamTruncated:boolean;
  sports:Array<{
   sport:string;eligibleQuoteCount:number;returnedQuoteCount:number;
   eligibleEventCount:number;returnedEventCount:number;
  }>;
 };
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

function compareQuotes(a:ObservedSportsbookQuote,b:ObservedSportsbookQuote){
 return Date.parse(a.startTime)-Date.parse(b.startTime)||a.event.localeCompare(b.event)||
  a.market.localeCompare(b.market)||a.selection.localeCompare(b.selection)||identity(a).localeCompare(identity(b));
}

function projectQuotes(eligible:ObservedSportsbookQuote[],upstreamTruncated:boolean){
 eligible.sort(compareQuotes);
 const bySport=new Map<string,ObservedSportsbookQuote[]>();
 for(const quote of eligible){
  const rows=bySport.get(quote.sport)||[];
  rows.push(quote);bySport.set(quote.sport,rows);
 }
 // A busy early-starting league must not consume every returned slot. Requests
 // and acquisition budgets are unchanged; this only selects already-collected rows.
 const groups=[...bySport].sort(([a],[b])=>a.localeCompare(b));
 const selected:ObservedSportsbookQuote[]=[];
 for(let offset=0;selected.length<Math.min(eligible.length,OBSERVED_ODDS_MAX_QUOTES);offset++){
  for(const [,rows] of groups){
   if(rows[offset])selected.push(rows[offset]);
   if(selected.length===OBSERVED_ODDS_MAX_QUOTES)break;
  }
 }
 const referenceQuotes=selected.sort(compareQuotes);
 const eventCount=(quotes:ObservedSportsbookQuote[])=>new Set(quotes.map(quote=>
  JSON.stringify([quote.league,quote.providerId,quote.sourceEventId,quote.startTime]))).size;
 return {
  referenceQuotes,
  coverageDetails:{
   eligibleQuoteCount:eligible.length,returnedQuoteCount:referenceQuotes.length,
   omittedQuoteCount:eligible.length-referenceQuotes.length,upstreamTruncated,
   sports:groups.map(([sport,quotes])=>{
    const returned=referenceQuotes.filter(quote=>quote.sport===sport);
    return {sport,eligibleQuoteCount:quotes.length,returnedQuoteCount:returned.length,
     eligibleEventCount:eventCount(quotes),returnedEventCount:eventCount(returned)};
   })
  }
 };
}

// These observations are display data. The explicit projection intentionally
// omits model probabilities, EV, confidence, stakes and consensus fields.
function assembleObservedOddsSnapshot(markets:ObservedMarketInput[],now:number,
 priorWithheld:NonNullable<ObservedOddsSnapshot['withheldObservations']>=[],upstreamTruncated=false):ObservedOddsSnapshot{
 const latest=new Map<string,{quote:ObservedSportsbookQuote;at:number;conflict:boolean}>();
 for(const row of markets){
  if(row.evidenceClass!=='OBSERVED_REFERENCE')continue;
  const observed=timestamp(row.quoteObservedAt),start=timestamp(row.startTime);
  if(!Number.isFinite(observed)||observed>now||now-observed>OBSERVED_ODDS_MAX_AGE_MS)continue;
  if(!Number.isFinite(start)||start<=now)continue;
  if(typeof row.odds!=='number'||!Number.isSafeInteger(row.odds)||Math.abs(row.odds)<100)continue;
  if([row.id,row.sport,row.league,row.event,row.market,row.selection,row.sourceBook,row.sourceEventId,row.sourceProviderId]
   .some(value=>typeof value!=='string'||!value.trim()))continue;
  const source=timestamp(row.sourceTimestamp);
  const quote:ObservedSportsbookQuote={
   id:row.id,sport:row.sport,league:row.league,event:row.event,selection:row.selection,
   market:row.market,startTime:new Date(start).toISOString(),odds:row.odds,bookmaker:row.sourceBook!,
   providerId:row.sourceProviderId!,sourceEventId:row.sourceEventId!,
   quoteObservedAt:new Date(observed).toISOString(),evidenceClass:'OBSERVED_REFERENCE',
   ...(Number.isFinite(source)&&source<=observed?{sourceTimestamp:new Date(source).toISOString()}:{})
  };
  const key=identity(quote);
  const previous=latest.get(key);
  if(!previous||observed>previous.at)latest.set(key,{quote,at:observed,conflict:false});
  else if(observed===previous.at&&quote.odds!==previous.quote.odds)previous.conflict=true;
 }
 const withheld=new Map<string,number>();
 for(const row of priorWithheld){
  const at=timestamp(row.quoteObservedAt);
  if(typeof row.identity==='string'&&Number.isFinite(at)&&at<=now&&now-at<=OBSERVED_ODDS_MAX_AGE_MS&&at>(withheld.get(row.identity)??-Infinity)){
   withheld.set(row.identity,at);
  }
 }
 for(const [key,value] of latest){
  if(value.conflict&&value.at>=(withheld.get(key)??-Infinity))withheld.set(key,value.at);
 }
 const eligible=[...latest].filter(([key,value])=>{
  if(value.conflict||(withheld.get(key)??-Infinity)>=value.at)return false;
  withheld.delete(key);
  return true;
 }).map(([,value])=>value.quote);
 const {referenceQuotes,coverageDetails}=projectQuotes(eligible,upstreamTruncated);
 const withheldObservations=[...withheld].map(([key,at])=>({identity:key,quoteObservedAt:new Date(at).toISOString()}));
 return {referenceCount:referenceQuotes.length,referenceQuotes,coverage:'PARTIAL',recommendationsAuthorized:false,
  maxObservationAgeMs:OBSERVED_ODDS_MAX_AGE_MS,withheldObservations,coverageDetails};
}

export function buildObservedOddsSnapshot(markets:ObservedMarketInput[],now=Date.now()):ObservedOddsSnapshot{
 return assembleObservedOddsSnapshot(markets,now);
}

export function mergeObservedOddsSnapshots(snapshots:Array<ObservedOddsSnapshot|null|undefined>,now=Date.now()):ObservedOddsSnapshot{
 // Conflicts are applied before the final cap, so withheld rows do not consume
 // return slots and an older cached copy cannot revive a conflicted quote.
 const markets=snapshots.flatMap(snapshot=>(snapshot?.referenceQuotes||[]).map(quote=>({
  ...quote,sourceBook:quote.bookmaker,sourceProviderId:quote.providerId
 })));
 const withheld=snapshots.flatMap(snapshot=>snapshot?.withheldObservations||[]);
 const upstreamTruncated=snapshots.some(snapshot=>snapshot?.coverageDetails?.upstreamTruncated||
  (snapshot?.coverageDetails?.omittedQuoteCount||0)>0);
 return assembleObservedOddsSnapshot(markets,now,withheld,upstreamTruncated);
}
