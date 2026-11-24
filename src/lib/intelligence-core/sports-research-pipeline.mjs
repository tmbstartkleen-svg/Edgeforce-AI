import {validatedQuote} from './market-opportunity-engine.mjs';
import {canonicalMarketIdentity} from './market-identity-and-movement.mjs';
import {evaluatePulseCandidate} from './pulse-risk-gate.mjs';
import {buildPlayerResearchSnapshot} from './player-research-snapshot.mjs';

const text=value=>typeof value==='string'&&value.trim().length>0;
const timestamp=value=>typeof value==='string'?Date.parse(value):NaN;
const openQuote=(q,now)=>q.marketStatus==='OPEN'&&text(q.sport)&&q.observedAt<=now&&
 Number.isFinite(timestamp(q.eventStartsAt))&&
 ((q.eventStatus==='UPCOMING'&&timestamp(q.eventStartsAt)>now)||
  (q.eventStatus==='LIVE'&&timestamp(q.eventStartsAt)<=now&&now-q.observedAt<=15000));
const contract=q=>JSON.stringify([q.marketIdentity,q.sport??null,q.selection,q.currency,q.side,
 q.outcomeSetType,[...q.outcomes].sort()]);

/**
 * Single research record for supplied quotes, scenario models and player logs.
 * Metadata assertions are not authentication. Even a complete record requires
 * independent source/model verification; this module never approves a wager.
 */
export function buildSportsResearchPipeline({quotes=[],forecasts=[],playerResearch=[]}={},
 {now=Date.now(),maxAgeMs=1200000,targetBook='DraftKings'}={}){
 if(!Array.isArray(quotes)||quotes.length>10000||!Array.isArray(forecasts)||forecasts.length>5000||
  !Array.isArray(playerResearch)||playerResearch.length>100||!Number.isFinite(now)||
  !Number.isFinite(maxAgeMs)||maxAgeMs<=0||!text(targetBook))throw new TypeError('INVALID_RESEARCH_PIPELINE');
 const rejectedQuotes=[],groups=new Map(),history=[];
 for(const raw of quotes){
  const checked=validatedQuote(raw,{now,maxAgeMs});
  if(!checked.ok){rejectedQuotes.push({reason:checked.reason});continue;}
  const q=checked.quote;
  if(q.venueType!=='SPORTSBOOK')continue;
  const key=contract(q);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(q);
 }
 for(const input of playerResearch){
  try{
   if(timestamp(input?.asOf)>now)throw new TypeError('FUTURE_RESEARCH_AS_OF');
   const snapshot=buildPlayerResearchSnapshot(input);
   history.push({playerId:input.playerId,stat:input.stat,threshold:input.threshold,
    asOf:input.asOf,snapshot});
  }catch{history.push({status:'INVALID_PLAYER_RESEARCH'});}
 }
 const models=new Map(),rejectedForecasts=[];
 for(const forecast of forecasts){
  const identity=canonicalMarketIdentity(forecast);
  if(!identity.ok||!text(forecast?.currency)||!Array.isArray(forecast.outcomes)||
   ![2,3].includes(forecast.outcomes.length)||new Set(forecast.outcomes).size!==forecast.outcomes.length||
   !forecast.outcomes.every(text)||!forecast.outcomes.includes(forecast.selection)||!['BACK','YES'].includes(forecast.side)||
   forecast.outcomes.length!==(forecast.outcomeSetType==='TWO_WAY'?2:forecast.outcomeSetType==='THREE_WAY'?3:0)){
   rejectedForecasts.push({reason:'FORECAST_CONTRACT_IDENTITY_REQUIRED'});continue;
  }
  const key=contract({...forecast,marketIdentity:identity.identity});
  if(!models.has(key))models.set(key,[]);
  models.get(key).push(forecast);
 }
 const records=[];
 for(const [key,group] of groups){
  const target=group.filter(q=>q.bookmaker.toLowerCase()===targetBook.toLowerCase())
   .sort((a,b)=>b.observedAt-a.observedAt)[0];
  if(!target)continue;
  const blockers=[],matching=models.get(key)??[];
  if(!text(target.sport))blockers.push('SPORT_IDENTITY_MISSING');
  if(target.marketStatus!=='OPEN')blockers.push('MARKET_OPEN_STATUS_UNVERIFIED');
  const start=timestamp(target.eventStartsAt);
  if(!Number.isFinite(start)||!['UPCOMING','LIVE'].includes(target.eventStatus)||
   (target.eventStatus==='UPCOMING'&&start<=now)||(target.eventStatus==='LIVE'&&start>now))
   blockers.push('EVENT_TIME_STATE_UNVERIFIED');
  if(target.eventStatus==='LIVE'&&now-target.observedAt>15000)blockers.push('LIVE_QUOTE_TOO_OLD');
  if(target.observedAt>now)blockers.push('FUTURE_SOURCE_QUOTE');
  const forecast=matching.length===1?matching[0]:null;
  if(!matching.length)blockers.push('EXACT_MODEL_FORECAST_MISSING');
  if(matching.length>1)blockers.push('AMBIGUOUS_MODEL_FORECASTS');
  const independentUpstreams=[...new Set(group.filter(q=>openQuote(q,now)).map(q=>q.upstreamId))];
  if(independentUpstreams.length<2)blockers.push('INDEPENDENT_UPSTREAM_CONSENSUS_MISSING');
  // Same timestamp, same source, conflicting prices cannot be resolved by array order.
  const observations=new Map();
  for(const q of group){
   const observationKey=JSON.stringify([q.providerId,q.upstreamId,q.bookmaker,q.observedAt]);
   if(observations.has(observationKey)&&observations.get(observationKey)!==q.odds)
    blockers.push('CONFLICTING_SOURCE_QUOTES');
   observations.set(observationKey,q.odds);
  }
  let pulse=null;
  if(forecast){
   const generated=timestamp(forecast.generatedAt),cutoff=timestamp(forecast.trainingCutoff);
   if(!text(forecast.modelId)||!text(forecast.modelVersion))blockers.push('MODEL_VERSION_MISSING');
   if(!Number.isFinite(generated)||generated>now||now-generated>maxAgeMs||
    !Number.isFinite(cutoff)||cutoff>=generated)blockers.push('MODEL_TIME_EVIDENCE_INVALID');
   if(!Array.isArray(forecast.inputReferences)||!forecast.inputReferences.length||
    !forecast.inputReferences.every(text))blockers.push('MODEL_INPUT_PROVENANCE_MISSING');
   if(!text(forecast.calibrationReference)||!text(forecast.holdoutReference))
    blockers.push('MODEL_VALIDATION_REFERENCES_MISSING');
   if(!Array.isArray(forecast.availabilityReferences)||!forecast.availabilityReferences.length||
    !forecast.availabilityReferences.every(text))blockers.push('AVAILABILITY_EVIDENCE_MISSING');
   try{
    pulse=evaluatePulseCandidate({americanOdds:target.odds,quoteObservedAt:target.observedAt,
     scenarios:forecast.scenarios,modelCalibrated:forecast.modelType==='CALIBRATED',
     outOfSampleVerified:forecast.outOfSampleVerified,sourceAudited:forecast.sourceAudited,
     lineupStatus:forecast.lineupStatus},{now,maxAgeMs});
    if(!pulse.evidenceReady)blockers.push('PULSE_REQUIRED_EVIDENCE_MISSING');
    else if(pulse.status!=='CANDIDATE_FOR_REVIEW')blockers.push(pulse.reason);
   }catch{blockers.push('INVALID_OR_MISSING_SCENARIO_MODEL');}
  }
  let playerEvidence=null;
  if(/player|prop/i.test(target.marketKey)){
   if(forecast&&forecast.lineValue!==target.lineValue)blockers.push('MODEL_THRESHOLD_MISMATCH');
   const matches=history.filter(h=>h.playerId===target.playerId&&h.snapshot?.sport===target.sport&&h.stat===target.statKey&&
    Number.isFinite(target.lineValue)&&h.threshold===target.lineValue);
   playerEvidence=matches.length===1?matches[0]:null;
   if(!playerEvidence||playerEvidence.snapshot.status!=='HISTORICAL_RESEARCH_ONLY')
    blockers.push('VERIFIED_PLAYER_HISTORY_MISSING');
   if(playerEvidence&&forecast&&timestamp(playerEvidence.asOf)>timestamp(forecast.generatedAt))
    blockers.push('PLAYER_RESEARCH_AFTER_MODEL');
  }
  records.push({
   id:key,sport:target.sport??null,eventId:target.eventId,marketKey:target.marketKey,marketIdentity:target.marketIdentity,
   settlementKey:target.settlementKey,selection:target.selection,currency:target.currency,
   playerId:target.playerId??null,statKey:target.statKey??null,lineKey:target.lineKey??null,lineValue:target.lineValue??null,
   periodKey:target.periodKey??'FULL',
   quote:{bookmaker:target.bookmaker,providerId:target.providerId,upstreamId:target.upstreamId,
    observedAt:target.observedAt,americanOdds:target.odds,decimalOdds:target.decimalOdds},
   breakEvenProbability:target.impliedProbability,
   model:forecast?{id:forecast.modelId??null,version:forecast.modelVersion??null,
    generatedAt:forecast.generatedAt??null,trainingCutoff:forecast.trainingCutoff??null,
    inputReferences:forecast.inputReferences??[],calibrationReference:forecast.calibrationReference??null,
    holdoutReference:forecast.holdoutReference??null,availabilityReferences:forecast.availabilityReferences??[]}:null,
   scenarioAnalysis:pulse,playerEvidence,independentUpstreams,
   status:blockers.length?'RESEARCH_ONLY':'CANDIDATE_REQUIRES_INDEPENDENT_VERIFICATION',
   blockers:[...new Set(blockers)],sourceAuthenticityCertified:false,
   productionBetRecommendationAuthorized:false,slipUrl:null,settlementReference:null,
  });
 }
 records.sort((a,b)=>Number(b.blockers.length===0)-Number(a.blockers.length===0)||
  (b.scenarioAnalysis?.conservativeExpectedRoi??-Infinity)-(a.scenarioAnalysis?.conservativeExpectedRoi??-Infinity)||
  a.id.localeCompare(b.id));
 return {schemaVersion:'sports-research-v1',mode:'SUPPLIED_EVIDENCE_RESEARCH_ONLY',
  generatedAt:new Date(now).toISOString(),records,rejectedQuotes,rejectedForecasts,
  coverage:{suppliedQuotes:quotes.length,acceptedQuotes:[...groups.values()].reduce((n,g)=>n+g.length,0),
   targetMarketRecords:records.length,suppliedForecasts:forecasts.length,
   suppliedPlayerResearch:playerResearch.length,completeSportsbookCoverageCertified:false},
  externalRequests:0,databaseWrites:0,ordersPlaced:0,providerActivationEnabled:false};
}
