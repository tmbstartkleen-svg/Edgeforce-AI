export const RETRYABLE_DEGRADED_HTTP=new Set([502,503,504]);

export function shouldRetryDegradedHttp(path,status,degradedAllowedPaths){
 return degradedAllowedPaths.has(path)&&RETRYABLE_DEGRADED_HTTP.has(Number(status));
}

export function parseSmokeJson(path,status,body){
 try{return JSON.parse(body)}
 catch{
  const preview=String(body||'').replace(/\s+/g,' ').slice(0,120);
  throw new Error(`${path} returned non-JSON HTTP ${status}${preview?`: ${preview}`:''}`);
 }
}

export function validateObservedOddsSnapshot(observed){
 if(observed?.recommendationsAuthorized!==false||observed?.coverage!=='PARTIAL'||
  !Array.isArray(observed.referenceQuotes)||observed.referenceCount!==observed.referenceQuotes.length||
  observed.referenceQuotes.length>1000){
  throw new Error('observed sportsbook reference contract mismatch');
 }
 for(const quote of observed.referenceQuotes){
  if(quote.evidenceClass!=='OBSERVED_REFERENCE'||!quote.sourceEventId||!quote.selection||!quote.bookmaker||
   !Number.isSafeInteger(quote.odds)||Math.abs(quote.odds)<100||!Number.isFinite(Date.parse(quote.quoteObservedAt))||
   !Number.isFinite(Date.parse(quote.startTime))||
   ['modelProb','marketProb','simProbability','expectedValue','recommendedStake','confidence','consensus'].some(key=>Object.hasOwn(quote,key))){
   throw new Error('observed sportsbook quote escaped its evidence boundary');
  }
 }
 const coverage=observed.coverageDetails;
 if(!coverage||!Array.isArray(coverage.sports)||typeof coverage.upstreamTruncated!=='boolean'||
  ![coverage.eligibleQuoteCount,coverage.returnedQuoteCount,coverage.omittedQuoteCount].every(value=>Number.isSafeInteger(value)&&value>=0)||
  coverage.returnedQuoteCount!==observed.referenceCount||coverage.eligibleQuoteCount-coverage.returnedQuoteCount!==coverage.omittedQuoteCount){
  throw new Error('observed sportsbook collection counts mismatch');
 }
 if(new Set(coverage.sports.map(row=>row.sport)).size!==coverage.sports.length||
  coverage.sports.reduce((sum,row)=>sum+row.returnedQuoteCount,0)!==observed.referenceCount||
  coverage.sports.reduce((sum,row)=>sum+row.eligibleQuoteCount,0)!==coverage.eligibleQuoteCount){
  throw new Error('observed sportsbook sport counts mismatch');
 }
 for(const row of coverage.sports){
  const returned=observed.referenceQuotes.filter(quote=>quote.sport===row.sport);
  if(![row.eligibleQuoteCount,row.returnedQuoteCount,row.eligibleEventCount,row.returnedEventCount].every(value=>Number.isSafeInteger(value)&&value>=0)||
   row.returnedQuoteCount!==returned.length||row.returnedQuoteCount>row.eligibleQuoteCount||row.returnedEventCount>row.eligibleEventCount){
   throw new Error('observed sportsbook per-sport coverage mismatch');
  }
 }
 return {referenceCount:observed.referenceCount,sports:[...new Set(observed.referenceQuotes.map(x=>x.sport))].sort(),
  bookmakers:[...new Set(observed.referenceQuotes.map(x=>x.bookmaker))].sort(),
  recommendationsAuthorized:false,sourceTimestampKnown:observed.referenceQuotes.filter(x=>Boolean(x.sourceTimestamp)).length,
  coverageDetails:coverage};
}

export function validateLiveBoardContinuity(json,status){
 if(json?.schema!=='edgeforce-live-board-v199'||![200,503].includes(status)||
  !Array.isArray(json.rows)||!Array.isArray(json.sports)||!json.history?.overall||
  !Array.isArray(json.predictions?.contracts)||!Array.isArray(json.historicalBets)||!Array.isArray(json.anomalies)||
  typeof json.coreStatus?.ok!=='boolean'||!['READY','NO_ELIGIBLE_MARKETS','CORE_TIMEOUT','CORE_FAILED'].includes(json.coreStatus.code)){
  throw new Error('live-board continuity contract mismatch');
 }
 if(json.coreStatus.ok!==(json.coreStatus.code==='READY')||
  (!json.coreStatus.ok&&(json.rows.length||json.sports.length||json.resimulationTriggered))||
  (status===503&&(json.coreStatus.ok||json.ok!==false||json.degraded!==true))){
  throw new Error('unavailable live-board core exposed model actions');
 }
 return {coreStatus:json.coreStatus,observationOnly:json.observationOnly===true,
  generatedAt:json.generatedAt,observedOdds:validateObservedOddsSnapshot(json.observedOdds),
  collection:json.liveScores?.collection??null};
}
