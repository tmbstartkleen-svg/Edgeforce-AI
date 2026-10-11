/** EdgeForce Sports Network v207: provenance-first past/present/future intelligence.
 * Observed odds, certified outcomes and forecast probabilities are different data classes.
 * These functions NEVER turn an AI inference into a sportsbook or official score feed.
 */
export type ChronicleEra='past'|'present'|'future';
export type EvidenceClass='HISTORICAL_MARKET'|'CURRENT_MARKET_OBSERVATION'|'MODEL_FORECAST';
export type ForecastEvidence='RESEARCH_SUPPORTED'|'UNCALIBRATED'|'STALE_MODEL'|'INVALID_MODEL';
const clock=(v:string|null|undefined)=>v?Date.parse(v):NaN;
const num=(v:unknown)=>v===null||v===undefined||v===''?NaN:Number(v);
const probability=(v:unknown)=>{const n=num(v);return Number.isFinite(n)&&n>0&&n<1?n:null};
const label=(v:unknown,max=100)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):'';
const iso=(v:string|null|undefined)=>Number.isFinite(clock(v))?new Date(clock(v)).toISOString():null;

export type ChroniclePastRow={
 eventId:string;sport:string;league:string;home:string;away:string;startTime:string;
 market:string|null;selection:string|null;offeredOdds:number|null;
 bookmaker:string|null;provider:string|null;observedAt:string|null;
 hasSettlementEvidence:boolean;gameResultConfirmed:boolean;
};
export type ChronicleNowRow={
 eventId:string;sport:string;league:string;home:string;away:string;startTime:string;
 market:string|null;selection:string|null;odds:number|null;bookmaker:string|null;
 provider:string|null;sourceObservedAt:string|null;pulledAt:string|null;
};
export type ChronicleFutureRow={
 eventId:string;sport:string;league:string;home:string;away:string;startTime:string;
 modelVersion:string;market:string;selection:string;probability:number;
 runs:number;ciLow:number|null;ciHigh:number|null;createdAt:string;
 calibrationSample:number|null;calibrationError:number|null;brierScore:number|null;
 calibrationPeriodEnd:string|null;
};
export function assessForecast(row:ChronicleFutureRow,now=Date.now()):{
 evidence:ForecastEvidence;reasons:string[];interval:[number,number]|null;
 calibrationSample:number|null;modelProbability:number|null;approvedForTrading:false;
}{
 const reasons:string[]=[];
 const p=probability(row.probability),lo=probability(row.ciLow),hi=probability(row.ciHigh);
 const start=clock(row.startTime),created=clock(row.createdAt);
 if(p===null)reasons.push('Model probability invalid or missing');
 if(!Number.isFinite(start)||start<=now)reasons.push('Game is no longer a future event');
 if(!Number.isFinite(created)||created>now+60000)reasons.push('Model creation time is invalid');
 const age=Number.isFinite(created)?(now-created)/3600000:Infinity;
 if(age>24||age<-.0167)reasons.push('Model output is not recent');
 if(!Number.isSafeInteger(row.runs)||row.runs<1000)reasons.push('Simulation sample too small or unverified');
 if(lo===null||hi===null||lo>hi||p===null||p<lo||p>hi)
  reasons.push('Monte Carlo interval is missing or contradictory');
 // Monte Carlo sampling intervals do NOT include structural/model error.
 const n=num(row.calibrationSample),err=num(row.calibrationError),brier=num(row.brierScore);
 const calDate=clock(row.calibrationPeriodEnd);
 const calibrated=Number.isSafeInteger(n)&&n>=200&&Number.isFinite(err)&&err>=0&&err<=.08&&
  Number.isFinite(brier)&&brier>=0&&brier<=.24&&
  Number.isFinite(calDate)&&calDate<=now&&calDate>=now-365*86400000;
 if(!calibrated)reasons.push('Recent settled-outcome calibration with sufficient sample not established');
 reasons.push('No verified live execution quote, independent bookmaker consensus or contract parity is certified');
 const invalid=p===null||!Number.isFinite(start)||start<=now||
  !Number.isFinite(created)||created>now+60000||lo===null||hi===null||lo>hi||p!==null&&(p<lo||p>hi);
 const evidence:ForecastEvidence=invalid?'INVALID_MODEL':age>24?'STALE_MODEL':!calibrated||row.runs<1000?'UNCALIBRATED':'RESEARCH_SUPPORTED';
 return {evidence,reasons,interval:lo!==null&&hi!==null&&lo<=hi?[lo,hi]:null,
  calibrationSample:Number.isSafeInteger(n)&&n>=0?n:null,modelProbability:p,
  approvedForTrading:false};
}
export function chroniclePast(rows:readonly ChroniclePastRow[],now=Date.now()){
 const entries=rows.slice(0,50).map(r=>{
  const observation=iso(r.observedAt);
  return {eventId:label(r.eventId),sport:label(r.sport),league:label(r.league),
   home:label(r.home),away:label(r.away),startTime:iso(r.startTime),
   evidenceClass:'HISTORICAL_MARKET' as EvidenceClass,
   market:r.market?label(r.market):null,selection:r.selection?label(r.selection):null,
   bookmaker:r.bookmaker?label(r.bookmaker):null,provider:r.provider?label(r.provider):null,
   observedAt:observation,offeredOdds:r.offeredOdds!==null&&Number.isSafeInteger(r.offeredOdds)&&Math.abs(r.offeredOdds)>=100?r.offeredOdds:null,
   settlementReferenceAvailable:Boolean(r.hasSettlementEvidence),
   outcome:'NOT_VERIFIED' as const,
   // Don't promote ledger bet settlement to an official team-score outcome.
   gameResultConfirmed:false,
   archiveAvailable:Boolean(observation)
  };
 });
 return {era:'past' as ChronicleEra,source:'EDGEFORCE_STORED_HISTORY',asOf:new Date(now).toISOString(),
  entries,coverage:{eventCount:entries.length,withTimestampedMarkets:entries.filter(x=>x.archiveAvailable).length,
   settledBetReferences:entries.filter(x=>x.settlementReferenceAvailable).length,
   verifiedFinalScores:0},
  warning:'Historical market tape and separately settled bet records are not an official game-results archive. Score/result coverage remains unavailable unless an authorized outcomes source is ingested.'};
}
export function chroniclePresent(rows:readonly ChronicleNowRow[],now=Date.now()){
 const entries=rows.slice(0,50).map(r=>{
  const source=iso(r.sourceObservedAt),received=iso(r.pulledAt);
  const age=source&&received?Math.max(0,(now-clock(source))/1000,(now-clock(received))/1000):null;
  const quoteValid=Number.isSafeInteger(r.odds)&&r.odds!==null&&Math.abs(r.odds)>=100;
  const valid=Boolean(source&&received&&quoteValid&&label(r.bookmaker)&&label(r.provider));
  const status=valid&&age!==null&&age<=120?'RECENT_OBSERVATION':valid?'STALE_OBSERVATION':'NO_VERIFIED_QUOTE';
  return {eventId:label(r.eventId),sport:label(r.sport),league:label(r.league),
   home:label(r.home),away:label(r.away),startTime:iso(r.startTime),
   evidenceClass:'CURRENT_MARKET_OBSERVATION' as EvidenceClass,
   market:quoteValid?label(r.market):null,selection:quoteValid?label(r.selection):null,
   odds:quoteValid?r.odds:null,bookmaker:label(r.bookmaker)||null,provider:label(r.provider)||null,
   observedAt:source,receivedAt:received,ageSeconds:age===null?null:Math.round(age),
   status,liveScoreVerified:false,executable:false};
 });
 return {era:'present' as ChronicleEra,source:'EDGEFORCE_STORED_MARKET_TAPE',asOf:new Date(now).toISOString(),entries,
  coverage:{eventCount:entries.length,recentQuotes:entries.filter(x=>x.status==='RECENT_OBSERVATION').length,
   withAnyVerifiedQuote:entries.filter(x=>x.status!=='NO_VERIFIED_QUOTE').length,
   uniqueBookmakers:new Set(entries.filter(x=>x.status==='RECENT_OBSERVATION').map(x=>x.bookmaker).filter(Boolean)).size,
   uniqueUpstreams:new Set(entries.filter(x=>x.status==='RECENT_OBSERVATION').map(x=>x.provider).filter(Boolean)).size},
  warning:'Recent market observations are not verified live scores, guaranteed execution prices or independent bookmaker consensus.'};
}
export function chronicleFuture(rows:readonly ChronicleFutureRow[],now=Date.now()){
 const seen=new Set<string>();const entries=[];
 for(const r of rows){
  const id=[r.eventId,r.market,r.selection].join('|');
  if(seen.has(id))continue;
  seen.add(id);
  const assessment=assessForecast(r,now);
  entries.push({eventId:label(r.eventId),sport:label(r.sport),league:label(r.league),
   home:label(r.home),away:label(r.away),startTime:iso(r.startTime),
   evidenceClass:'MODEL_FORECAST' as EvidenceClass,
   modelVersion:label(r.modelVersion),market:label(r.market),selection:label(r.selection),
   modelCreatedAt:iso(r.createdAt),simulationRuns:r.runs,
   probability:assessment.modelProbability,monteCarloInterval:assessment.interval,
   forecastEvidence:assessment.evidence,calibrationSample:assessment.calibrationSample,
   calibrationPeriodEnd:iso(r.calibrationPeriodEnd),reasons:assessment.reasons,
   approvedForTrading:false,realWorldOutcomeKnown:false
  });
  if(entries.length>=50)break;
 }
 return {era:'future' as ChronicleEra,source:'EDGEFORCE_RECORDED_MODEL_RUNS',asOf:new Date(now).toISOString(),entries,
  coverage:{forecastRows:entries.length,researchSupported:entries.filter(x=>x.forecastEvidence==='RESEARCH_SUPPORTED').length,
   needsCalibration:entries.filter(x=>x.forecastEvidence==='UNCALIBRATED').length,
   invalidOrStale:entries.filter(x=>x.forecastEvidence==='INVALID_MODEL'||x.forecastEvidence==='STALE_MODEL').length},
  warning:'Forecasts are uncertain model outputs, not future facts or independent sportsbook feeds. Monte Carlo intervals exclude model error. All entries require fresh independent odds, matching settlement rules and legal source rights before trading.'};
}
