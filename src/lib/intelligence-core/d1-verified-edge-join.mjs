import {screenValueEdges} from './market-opportunity-engine.mjs';

const text=value=>typeof value==='string'&&value.trim().length>0;
const time=value=>typeof value==='string'?Date.parse(value):NaN;
const finite=value=>Number.isFinite(Number(value));
const count=(map,key)=>{map[key]=(map[key]||0)+1};

function snapshot(row){
 try{
  const raw=typeof row?.feature_snapshot==='string'?JSON.parse(row.feature_snapshot):row?.feature_snapshot;
  return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:null;
 }catch{return null}
}

function validatedCalibration(row,feature,calibrations,modelCreatedAt){
 const matches=(Array.isArray(calibrations)?calibrations:[]).filter(cal=>
  cal?.model_version===row.model_version&&cal?.market_key===row.market_key&&
  (!text(cal.sport)||cal.sport===feature.sport)
 ).filter(cal=>{
  const created=time(cal.created_at),periodEnd=time(cal.period_end);
  return Number.isFinite(created)&&Number.isFinite(periodEnd)&&created<=modelCreatedAt&&periodEnd<=modelCreatedAt;
 }).sort((a,b)=>time(b.created_at)-time(a.created_at));
 const cal=matches[0];
 if(!cal)return {ok:false,reason:'NO_PRIOR_CALIBRATION_EVIDENCE'};
 const sample=Number(cal.sample_size),brier=Number(cal.brier_score),logLoss=Number(cal.log_loss),error=Number(cal.calibration_error);
 if(!Number.isInteger(sample)||sample<75)return {ok:false,reason:'CALIBRATION_SAMPLE_INSUFFICIENT'};
 if(!finite(brier)||brier<0||brier>.28)return {ok:false,reason:'CALIBRATION_BRIER_FAILED'};
 if(!finite(logLoss)||logLoss<0||logLoss>.78)return {ok:false,reason:'CALIBRATION_LOG_LOSS_FAILED'};
 if(!finite(error)||error<0||error>.10)return {ok:false,reason:'CALIBRATION_ERROR_FAILED'};
 return {ok:true,calibration:{id:cal.id??null,sampleSize:sample,brierScore:brier,logLoss,calibrationError:error,
  periodEnd:cal.period_end,createdAt:cal.created_at}};
}

function forecastFrom(row,feature){
 return {
  eventId:row.event_id,marketKey:row.market_key,selection:row.selection_key,
  probability:Number(row.model_probability),modelType:'CALIBRATED',outOfSampleVerified:true,sourceAudited:true,
  sport:feature.sport,settlementKey:feature.settlementKey,currency:feature.currency,outcomes:feature.outcomes,
  ...(text(feature.lineKey)?{lineKey:feature.lineKey}:{}),
  ...(text(feature.periodKey)?{periodKey:feature.periodKey}:{}),
  ...(text(feature.playerId)?{playerId:feature.playerId}:{}),
  ...(text(feature.statKey)?{statKey:feature.statKey}:{})
 };
}

/**
 * Joins already-stored D1 quote, model and calibration evidence.
 * Never infers a probability from price, never authenticates upstream ownership,
 * and never authorizes a wager. A returned row is review-only.
 */
export function reviewD1ModelEdges(quotes,modelRuns,calibrations,{
 now=Date.now(),targetBook='DraftKings',maxModelAgeMs=48*60*60*1000
}={}){
 if(!Array.isArray(quotes)||!Array.isArray(modelRuns)||!Array.isArray(calibrations)||
  !Number.isFinite(now)||!text(targetBook)||!Number.isFinite(maxModelAgeMs)||maxModelAgeMs<=0)
  throw new TypeError('INVALID_D1_EDGE_REVIEW_INPUT');

 const rejectionReasons={},candidates=[];
 let calibrationMatched=0,eligibleModels=0,exactQuoteMatches=0;

 for(const row of modelRuns.slice(0,1000)){
  const reasons=[];
  if(!row||!text(row.event_id)||!text(row.market_key)||!text(row.selection_key)||!text(row.model_version))
   reasons.push('INVALID_MODEL_IDENTITY');
  if(!Number.isSafeInteger(Number(row?.run_count))||Number(row?.run_count)<1)
   reasons.push('INVALID_STORED_RUN_COUNT');
  const probability=Number(row?.model_probability);
  if(!Number.isFinite(probability)||probability<=0||probability>=1)reasons.push('INVALID_MODEL_PROBABILITY');
  const createdAt=time(row?.created_at);
  if(!Number.isFinite(createdAt)||createdAt>now+30000||now-createdAt>maxModelAgeMs)reasons.push('STALE_OR_INVALID_MODEL_RUN');

  const feature=snapshot(row);
  if(!feature)reasons.push('INVALID_FEATURE_SNAPSHOT');
  if(feature){
   if(feature.probabilityOrigin!=='INDEPENDENT_MODEL')reasons.push('MODEL_ORIGIN_NOT_INDEPENDENT');
   if(feature.outOfSampleVerified!==true)reasons.push('OUT_OF_SAMPLE_EVIDENCE_MISSING');
   if(!['QUALIFIED','VERIFIED'].includes(String(feature.validationEvidenceGrade||''))||feature.promotionEligible!==true)
    reasons.push('VALIDATION_LAB_PROMOTION_NOT_EVIDENCED');
   if(!text(feature.validationEvidenceId))reasons.push('VALIDATION_EVIDENCE_ID_MISSING');
   if(!text(feature.sport)||!text(feature.settlementKey)||!text(feature.currency)||
    !Array.isArray(feature.outcomes)||![2,3].includes(feature.outcomes.length)||!feature.outcomes.every(text))
    reasons.push('MODEL_MARKET_CONTRACT_INCOMPLETE');
  }
  const start=feature?time(feature.eventStartTime):NaN;
  if(!Number.isFinite(start)||!Number.isFinite(createdAt)||createdAt>=start)reasons.push('MODEL_NOT_PREGAME');

  if(reasons.length){
   for(const reason of new Set(reasons))count(rejectionReasons,reason);
   continue;
  }

  const cal=validatedCalibration(row,feature,calibrations,createdAt);
  if(!cal.ok){count(rejectionReasons,cal.reason);continue}
  calibrationMatched++;
  eligibleModels++;

  const compatible=quotes.filter(q=>{
   if(!q||q.eventId!==row.event_id||q.marketKey!==row.market_key||q.selection!==row.selection_key)return false;
   if(q.sport!==feature.sport||q.settlementKey!==feature.settlementKey||q.currency!==feature.currency)return false;
   if(JSON.stringify(q.outcomes)!==JSON.stringify(feature.outcomes))return false;
   const qStart=Number(q.eventStartTime);
   if(!Number.isFinite(qStart)||Math.abs(qStart-start)>60000)return false;
   if(q.observedAt<createdAt||q.observedAt>=start)return false;
   return true;
  });
  if(!compatible.length){count(rejectionReasons,'NO_POST_FORECAST_EXACT_QUOTES');continue}
  const target=compatible.filter(q=>String(q.bookmaker).toLowerCase()===targetBook.toLowerCase())
   .sort((a,b)=>b.observedAt-a.observedAt)[0];
  if(!target){count(rejectionReasons,'TARGET_BOOK_QUOTE_MISSING');continue}
  const upstreams=new Set(compatible.map(q=>q.upstreamId).filter(text));
  if(upstreams.size<2){count(rejectionReasons,'INDEPENDENT_UPSTREAM_CONSENSUS_MISSING');continue}
  exactQuoteMatches++;

  const screened=screenValueEdges(compatible,[forecastFrom(row,feature)],{now,targetBook,maxAgeMs:20*60*1000});
  const edge=screened.results[0];
  if(!edge){count(rejectionReasons,'CANONICAL_MARKET_IDENTITY_OR_QUOTE_MISMATCH');continue}
  if(edge.status!=='CANDIDATE_FOR_FURTHER_REVIEW'){
   for(const reason of edge.blockers||['EDGE_GATE_BLOCKED'])count(rejectionReasons,reason);
   continue;
  }
  candidates.push({...edge,
   modelRunId:row.id??null,modelVersion:row.model_version,modelCreatedAt:row.created_at,
   storedRunCount:Number(row.run_count),validationEvidenceGrade:feature.validationEvidenceGrade,
   validationEvidenceId:feature.validationEvidenceId,calibration:cal.calibration,
   evidenceJoin:'D1_STORED_QUOTE_MODEL_CALIBRATION',approvalScope:'REVIEW_ONLY',
   upstreamIdentityIndependentlyAuthenticated:false,productionBetRecommendationAuthorized:false});
 }

 return {
  mode:'D1_MODEL_EDGE_EVIDENCE_JOIN_REVIEW_ONLY',
  modelsExamined:Math.min(modelRuns.length,1000),eligibleModels,calibrationMatched,exactQuoteMatches,
  candidateCount:candidates.length,candidates:candidates.sort((a,b)=>b.expectedRoi-a.expectedRoi),
  rejectionReasons,probabilitiesInvented:0,pricesInvented:0,networkRequests:0,ordersPlaced:0,
  upstreamIdentityIndependentlyAuthenticated:false,productionBetRecommendationAuthorized:false
 };
}
