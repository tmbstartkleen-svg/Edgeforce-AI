import {screenValueEdges} from './market-opportunity-engine.mjs';
import {canonicalMarketIdentity} from './market-identity-and-movement.mjs';

const text=value=>typeof value==='string'&&value.trim().length>0;
const time=value=>typeof value==='string'?Date.parse(value):NaN;
// D1 numeric columns return numbers. Missing values must never become perfect scores.
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const recordId=value=>Number.isSafeInteger(value)&&value>0?value:0;
const count=(map,key)=>{map[key]=(map[key]||0)+1};

function snapshot(row){
 try{
  const raw=typeof row?.feature_snapshot==='string'?JSON.parse(row.feature_snapshot):row?.feature_snapshot;
  return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:null;
 }catch{return null}
}

function modelFamily(row){
 return row&&[row.event_id,row.market_key,row.selection_key,row.model_version].every(text)
  ?JSON.stringify([row.event_id,row.market_key,row.selection_key,row.model_version]):null;
}

const validModelAxes=feature=>['lineKey','periodKey','playerId','statKey']
 .every(field=>!(field in feature)||text(feature[field]));

function modelContract(row,feature){
 if(!modelFamily(row)||!feature||!validModelAxes(feature)||![feature.sport,feature.settlementKey,feature.currency].every(text)||
  !Array.isArray(feature.outcomes)||![2,3].includes(feature.outcomes.length)||
  !feature.outcomes.every(text)||new Set(feature.outcomes).size!==feature.outcomes.length||
  !feature.outcomes.includes(row.selection_key))return null;
 const identity=canonicalMarketIdentity({eventId:row.event_id,marketKey:row.market_key,selection:row.selection_key,
  settlementKey:feature.settlementKey,lineKey:feature.lineKey,periodKey:feature.periodKey,
  playerId:feature.playerId,statKey:feature.statKey});
 return identity.ok?JSON.stringify([row.model_version,identity.identity,row.selection_key,
  feature.sport,feature.currency,[...feature.outcomes].sort()]):null;
}

function couldReviseContract(partial,known){
 if(!partial)return true;
 const defaults={lineKey:'STRAIGHT',periodKey:'FULL',playerId:'',statKey:''};
 for(const field of ['sport','settlementKey','currency','lineKey','periodKey','playerId','statKey']){
  const expected=text(known[field])?known[field]:defaults[field];
  if(text(partial[field])&&partial[field]!==expected)return false;
 }
 if(Array.isArray(partial.outcomes)&&[2,3].includes(partial.outcomes.length)&&partial.outcomes.every(text)&&
  new Set(partial.outcomes).size===partial.outcomes.length&&
  JSON.stringify([...partial.outcomes].sort())!==JSON.stringify([...known.outcomes].sort()))return false;
 return true;
}

/** Pick current evidence before eligibility checks; rejected corrections never revive older favorable forecasts. */
function currentModelRuns(modelRuns,rejectionReasons){
 const groups=new Map(),unidentified=new Map(),selected=[];
 for(const row of modelRuns.slice(0,1000)){
  const feature=snapshot(row),family=modelFamily(row),contract=modelContract(row,feature);
  const entry={row,feature,createdAt:time(row?.created_at),id:recordId(row?.id),family};
  if(!contract){
   selected.push(row); // Preserve the ordinary validation diagnostics for this invalid record.
   if(family){if(!unidentified.has(family))unidentified.set(family,[]);unidentified.get(family).push(entry);}
   continue;
  }
  if(!groups.has(contract))groups.set(contract,[]);
  groups.get(contract).push(entry);
 }
 for(const group of groups.values()){
  if(group.length>1&&group.some(entry=>!Number.isFinite(entry.createdAt))){
   count(rejectionReasons,'AMBIGUOUS_MODEL_RUN_RECENCY');continue;
  }
  const latestTime=Math.max(...group.map(entry=>entry.createdAt));
  let latest=group.length===1?group:group.filter(entry=>entry.createdAt===latestTime);
  if(latest.length>1&&latest.every(entry=>entry.id>0)){
   const latestId=Math.max(...latest.map(entry=>entry.id));
   latest=latest.filter(entry=>entry.id===latestId);
  }
  // Equal timestamps without an ordering ID, or conflicting copies of one ID,
  // cannot be resolved by source-array order. Identical repeats count only once.
  if(latest.length>1&&new Set(latest.map(entry=>JSON.stringify(entry.row))).size>1){
   count(rejectionReasons,'CONFLICTING_LATEST_MODEL_RUNS');continue;
  }
  const winner=latest[0];
  const unknownRevision=(unidentified.get(winner.family)||[]).some(entry=>
   couldReviseContract(entry.feature,winner.feature)&&
   (!Number.isFinite(entry.createdAt)||!Number.isFinite(winner.createdAt)||entry.createdAt>winner.createdAt||
   (entry.createdAt===winner.createdAt&&!(entry.id>0&&winner.id>0&&entry.id<winner.id))));
  if(unknownRevision){count(rejectionReasons,'MODEL_CONTRACT_REVISION_UNVERIFIED');continue;}
  for(let i=1;i<group.length;i++)count(rejectionReasons,'SUPERSEDED_MODEL_RUN');
  selected.push(winner.row);
 }
 return selected;
}

function validatedCalibration(row,feature,calibrations,modelCreatedAt){
 const matches=(Array.isArray(calibrations)?calibrations:[]).filter(cal=>
  cal?.model_version===row.model_version&&cal?.market_key===row.market_key&&cal?.sport===feature.sport
 ).filter(cal=>{
  const created=time(cal.created_at);
  return Number.isFinite(created)&&created<=modelCreatedAt;
 }).sort((a,b)=>time(b.created_at)-time(a.created_at)||recordId(b.id)-recordId(a.id));
 const cal=matches[0];
 if(!cal)return {ok:false,reason:'NO_PRIOR_CALIBRATION_EVIDENCE'};
 const periodEnd=time(cal.period_end);
 if(!Number.isFinite(periodEnd)||periodEnd>time(cal.created_at))
  return {ok:false,reason:'INVALID_CALIBRATION_PERIOD'};
 const sample=cal.sample_size,brier=cal.brier_score,logLoss=cal.log_loss,error=cal.calibration_error;
 if(!Number.isSafeInteger(sample)||sample<75)return {ok:false,reason:'CALIBRATION_SAMPLE_INSUFFICIENT'};
 if(!finite(brier)||brier<0||brier>.28)return {ok:false,reason:'CALIBRATION_BRIER_FAILED'};
 if(!finite(logLoss)||logLoss<0||logLoss>.78)return {ok:false,reason:'CALIBRATION_LOG_LOSS_FAILED'};
 if(!finite(error)||error<0||error>.10)return {ok:false,reason:'CALIBRATION_ERROR_FAILED'};
 return {ok:true,calibration:{id:cal.id??null,sampleSize:sample,brierScore:brier,logLoss,calibrationError:error,
  periodEnd:cal.period_end,createdAt:cal.created_at}};
}

function forecastFrom(row,feature){
 return {
  eventId:row.event_id,marketKey:row.market_key,selection:row.selection_key,
  probability:row.model_probability,modelType:'CALIBRATED',outOfSampleVerified:true,sourceAudited:true,
  sport:feature.sport,settlementKey:feature.settlementKey,currency:feature.currency,outcomes:feature.outcomes,
  side:'BACK',outcomeSetType:feature.outcomes.length===2?'TWO_WAY':'THREE_WAY',
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

 for(const row of currentModelRuns(modelRuns,rejectionReasons)){
  const reasons=[];
  if(!row||!text(row.event_id)||!text(row.market_key)||!text(row.selection_key)||!text(row.model_version))
   reasons.push('INVALID_MODEL_IDENTITY');
  if(!Number.isSafeInteger(row?.run_count)||row?.run_count<1)
   reasons.push('INVALID_STORED_RUN_COUNT');
  const probability=row?.model_probability;
  if(!finite(probability)||probability<=0||probability>=1)reasons.push('INVALID_MODEL_PROBABILITY');
  const createdAt=time(row?.created_at);
  if(!Number.isFinite(createdAt)||createdAt>now+30000||now-createdAt>maxModelAgeMs)reasons.push('STALE_OR_INVALID_MODEL_RUN');

  const feature=snapshot(row);
  if(!feature)reasons.push('INVALID_FEATURE_SNAPSHOT');
  if(feature){
   if(feature.probabilityOrigin!=='INDEPENDENT_MODEL')reasons.push('MODEL_ORIGIN_NOT_INDEPENDENT');
   if(feature.outOfSampleVerified!==true)reasons.push('OUT_OF_SAMPLE_EVIDENCE_MISSING');
   if(!['QUALIFIED','VERIFIED'].includes(feature.validationEvidenceGrade)||feature.promotionEligible!==true)
    reasons.push('VALIDATION_LAB_PROMOTION_NOT_EVIDENCED');
   if(!text(feature.validationEvidenceId))reasons.push('VALIDATION_EVIDENCE_ID_MISSING');
   if(!text(feature.sport)||!text(feature.settlementKey)||!text(feature.currency)||!validModelAxes(feature)||
    !Array.isArray(feature.outcomes)||![2,3].includes(feature.outcomes.length)||!feature.outcomes.every(text))
    reasons.push('MODEL_MARKET_CONTRACT_INCOMPLETE');
  }
  const start=feature?time(feature.eventStartTime):NaN;
  if(!Number.isFinite(start)||!Number.isFinite(createdAt)||createdAt>=start)reasons.push('MODEL_NOT_PREGAME');
  if(Number.isFinite(start)&&start<=now)reasons.push('EVENT_ALREADY_STARTED');

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
   const qStart=q.eventStartTime;
   if(!finite(qStart)||qStart<=now||Math.abs(qStart-start)>60000)return false;
   if(!finite(q.observedAt))return false;
   if(q.observedAt<createdAt||q.observedAt>=start||q.observedAt>=qStart)return false;
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
   storedRunCount:row.run_count,validationEvidenceGrade:feature.validationEvidenceGrade,
   validationEvidenceId:feature.validationEvidenceId,calibration:cal.calibration,
   validationEvidenceSource:'MODEL_FEATURE_ASSERTION',validationEvidenceIndependentlyVerified:false,
   evidenceJoin:'D1_STORED_QUOTE_MODEL_CALIBRATION',approvalScope:'REVIEW_ONLY',
   upstreamIdentityIndependentlyAuthenticated:false,productionBetRecommendationAuthorized:false});
 }

 return {
  mode:'D1_MODEL_EDGE_EVIDENCE_JOIN_REVIEW_ONLY',
  modelsExamined:Math.min(modelRuns.length,1000),eligibleModels,calibrationMatched,exactQuoteMatches,
  candidateCount:candidates.length,candidates:candidates.sort((a,b)=>b.expectedRoi-a.expectedRoi),
  rejectionReasons,probabilitiesInvented:0,pricesInvented:0,networkRequests:0,ordersPlaced:0,
  validationEvidenceIndependentlyVerified:false,
  upstreamIdentityIndependentlyAuthenticated:false,productionBetRecommendationAuthorized:false
 };
}
