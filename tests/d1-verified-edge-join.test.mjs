import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewD1ModelEdges} from '../src/lib/intelligence-core/d1-verified-edge-join.mjs';

const now=Date.parse('2026-11-25T00:00:00Z');
const start=Date.parse('2026-11-25T03:00:00Z');
const quote=(bookmaker,upstreamId,odds=120,extra={})=>({
 eventId:'nba:event-1',marketKey:'moneyline',selection:'Home',bookmaker,providerId:'provider-'+upstreamId,upstreamId,
 observedAt:now-30000,odds,settlementKey:'NBA_FULL_GAME_PLUS_OVERTIME',currency:'USD',
 venueType:'SPORTSBOOK',side:'BACK',outcomeSetType:'TWO_WAY',outcomes:['Home','Away'],sport:'NBA',
 eventStartTime:start,...extra
});
const feature={
 probabilityOrigin:'INDEPENDENT_MODEL',outOfSampleVerified:true,validationEvidenceGrade:'QUALIFIED',
 promotionEligible:true,validationEvidenceId:'validation-run-42',sport:'NBA',
 eventStartTime:new Date(start).toISOString(),settlementKey:'NBA_FULL_GAME_PLUS_OVERTIME',
 currency:'USD',outcomes:['Home','Away']
};
const model={id:7,event_id:'nba:event-1',market_key:'moneyline',selection_key:'Home',model_version:'model-v1',
 run_count:500000,model_probability:.52,created_at:new Date(now-60000).toISOString(),feature_snapshot:JSON.stringify(feature)};
const calibration={id:2,model_version:'model-v1',sport:'NBA',market_key:'moneyline',sample_size:120,
 brier_score:.22,log_loss:.68,calibration_error:.06,period_end:'2026-11-23T00:00:00Z',created_at:'2026-11-24T00:00:00Z'};

test('exact stored quote + independent model + prior calibration yields review candidate only',()=>{
 const r=reviewD1ModelEdges([quote('DraftKings','ownerA'),quote('FanDuel','ownerB',115)],[model],[calibration],{now});
 assert.equal(r.candidateCount,1);
 const x=r.candidates[0];
 assert.equal(x.status,'CANDIDATE_FOR_FURTHER_REVIEW');
 assert.equal(x.productionBetRecommendationAuthorized,false);
 assert.equal(x.upstreamIdentityIndependentlyAuthenticated,false);
 assert.equal(x.validationEvidenceGrade,'QUALIFIED');
 assert.equal(x.validationEvidenceSource,'MODEL_FEATURE_ASSERTION');
 assert.equal(x.validationEvidenceIndependentlyVerified,false);
 assert.equal(r.validationEvidenceIndependentlyVerified,false);
 assert.ok(x.expectedRoi>0);
 assert.equal(r.ordersPlaced,0);assert.equal(r.networkRequests,0);
});

test('model chronology must precede both quote and event start',()=>{
 const late={...model,created_at:new Date(now+1000).toISOString()};
 const r=reviewD1ModelEdges([quote('DraftKings','ownerA'),quote('FanDuel','ownerB')],[late],[calibration],{now});
 assert.equal(r.candidateCount,0);
 assert.ok(r.rejectionReasons.NO_POST_FORECAST_EXACT_QUOTES||r.rejectionReasons.STALE_OR_INVALID_MODEL_RUN);
});

test('validation-lab promotion evidence and prior calibration are mandatory',()=>{
 const weak={...model,feature_snapshot:JSON.stringify({...feature,validationEvidenceGrade:'PROVISIONAL',promotionEligible:false})};
 const a=reviewD1ModelEdges([quote('DraftKings','ownerA'),quote('FanDuel','ownerB')],[weak],[calibration],{now});
 assert.equal(a.candidateCount,0);assert.equal(a.rejectionReasons.VALIDATION_LAB_PROMOTION_NOT_EVIDENCED,1);
 const futureCal={...calibration,period_end:'2026-11-25T02:00:00Z',created_at:'2026-11-25T02:01:00Z'};
 const b=reviewD1ModelEdges([quote('DraftKings','ownerA'),quote('FanDuel','ownerB')],[model],[futureCal],{now});
 assert.equal(b.candidateCount,0);assert.equal(b.rejectionReasons.NO_PRIOR_CALIBRATION_EVIDENCE,1);
});

test('two independently labeled upstreams and target-book quote are required',()=>{
 const one=reviewD1ModelEdges([quote('DraftKings','ownerA')],[model],[calibration],{now});
 assert.equal(one.candidateCount,0);assert.equal(one.rejectionReasons.INDEPENDENT_UPSTREAM_CONSENSUS_MISSING,1);
 const missing=reviewD1ModelEdges([quote('FanDuel','ownerA'),quote('Pinnacle','ownerB')],[model],[calibration],{now});
 assert.equal(missing.candidateCount,0);assert.equal(missing.rejectionReasons.TARGET_BOOK_QUOTE_MISSING,1);
});

test('derivative identity mismatch cannot be silently joined',()=>{
 const propFeature={...feature,settlementKey:'NBA_PLAYER_POINTS_FULL_GAME',outcomes:['Over','Under'],lineKey:'24.5',periodKey:'FULL',playerId:'p1',statKey:'points'};
 const propModel={...model,market_key:'player_points',selection_key:'Over',feature_snapshot:JSON.stringify(propFeature)};
 const propQuote=book=>({...quote(book,book==='DraftKings'?'ownerA':'ownerB'),marketKey:'player_points',selection:'Over',
  settlementKey:'NBA_PLAYER_POINTS_FULL_GAME',outcomes:['Over','Under'],lineKey:'25.5',periodKey:'FULL',playerId:'p1',statKey:'points'});
 const r=reviewD1ModelEdges([propQuote('DraftKings'),propQuote('FanDuel')],[propModel],[{...calibration,market_key:'player_points'}],{now});
 assert.equal(r.candidateCount,0);
 assert.equal(r.rejectionReasons.CANONICAL_MARKET_IDENTITY_OR_QUOTE_MISMATCH,1);
});

const review=(models=[model],calibrations=[calibration],quotes=[quote('DraftKings','ownerA'),quote('FanDuel','ownerB')])=>
 reviewD1ModelEdges(quotes,models,calibrations,{now});

test('missing, coerced and non-finite calibration scores cannot become perfect calibration',()=>{
 for(const [field,reason] of [
  ['brier_score','CALIBRATION_BRIER_FAILED'],['log_loss','CALIBRATION_LOG_LOSS_FAILED'],
  ['calibration_error','CALIBRATION_ERROR_FAILED']
 ]){
  for(const invalid of [null,undefined,'',' ',false,true,[],[0],'0','0.05',NaN,Infinity,-Infinity]){
   const r=review([model],[{...calibration,[field]:invalid}]);
   assert.equal(r.candidateCount,0,`${field} must reject ${String(invalid)}`);
   assert.equal(r.rejectionReasons[reason],1);
  }
 }
 // An actual numeric zero remains valid; an absent score is a different state.
 assert.equal(review([model],[{...calibration,brier_score:0,log_loss:0,calibration_error:0}]).candidateCount,1);
});

test('calibration thresholds use finite scores and a safe integer sample count',()=>{
 const boundary={...calibration,sample_size:75,brier_score:.28,log_loss:.78,calibration_error:.10};
 assert.equal(review([model],[boundary]).candidateCount,1);
 for(const [field,value] of [
  ['sample_size',74],['sample_size',75.5],['sample_size','120'],['sample_size',Number.MAX_SAFE_INTEGER+1],
  ['brier_score',.280001],['log_loss',.780001],['calibration_error',.100001],
  ['brier_score',-.01],['log_loss',-.01],['calibration_error',-.01]
 ])assert.equal(review([model],[{...boundary,[field]:value}]).candidateCount,0,`${field}=${value}`);
});

test('calibration must explicitly match the model sport',()=>{
 for(const sport of [null,undefined,'','NFL']){
  const r=review([model],[{...calibration,sport}]);
  assert.equal(r.candidateCount,0);
  assert.equal(r.rejectionReasons.NO_PRIOR_CALIBRATION_EVIDENCE,1);
 }
});

test('calibration period must exist and end before its record was created',()=>{
 for(const period_end of [null,'','not-a-date','2026-11-24T12:00:00Z']){
  const r=review([model],[{...calibration,period_end}]);
  assert.equal(r.candidateCount,0);
  assert.equal(r.rejectionReasons.INVALID_CALIBRATION_PERIOD,1);
 }
 // An invalid newest record cannot be bypassed by choosing an older favorable score.
 const latest={...calibration,id:3,created_at:'2026-11-24T12:00:00Z',period_end:'2026-11-24T13:00:00Z'};
 assert.equal(review([model],[calibration,latest]).candidateCount,0);
 assert.equal(review([model],[latest,calibration]).candidateCount,0);
});

test('timestamp-tied calibration records follow the latest stored ID without cherry-picking',()=>{
 const newer={...calibration,id:3,brier_score:.4};
 for(const rows of [[calibration,newer],[newer,calibration]]){
  const r=review([model],rows);
  assert.equal(r.candidateCount,0);
  assert.equal(r.rejectionReasons.CALIBRATION_BRIER_FAILED,1);
 }
});

test('pregame observations expire when the event begins even inside quote freshness window',()=>{
 for(const eventStartTime of [now-30000,now]){
  const pastModel={...model,created_at:new Date(now-90000).toISOString(),
   feature_snapshot:JSON.stringify({...feature,eventStartTime:new Date(eventStartTime).toISOString()})};
  const quotes=[quote('DraftKings','ownerA',120,{observedAt:now-60000,eventStartTime}),
   quote('FanDuel','ownerB',115,{observedAt:now-60000,eventStartTime})];
  const r=review([pastModel],[calibration],quotes);
  assert.equal(r.candidateCount,0);
  assert.equal(r.rejectionReasons.EVENT_ALREADY_STARTED,1);
 }
});

test('a started quote event cannot borrow the model schedule tolerance to stay eligible',()=>{
 const futureModel={...model,feature_snapshot:JSON.stringify({...feature,eventStartTime:new Date(now+30000).toISOString()})};
 const quotes=[quote('DraftKings','ownerA',120,{eventStartTime:now}),quote('FanDuel','ownerB',115,{eventStartTime:now})];
 assert.equal(review([futureModel],[calibration],quotes).candidateCount,0);
});

test('schedule and clock skew cannot make a post-start quote appear pregame',()=>{
 const futureModel={...model,feature_snapshot:JSON.stringify({...feature,eventStartTime:new Date(now+40000).toISOString()})};
 const qStart=now+10000;
 for(const observedAt of [qStart,qStart+10000]){
  const quotes=[quote('DraftKings','ownerA',120,{eventStartTime:qStart,observedAt}),
   quote('FanDuel','ownerB',115,{eventStartTime:qStart,observedAt})];
  const r=review([futureModel],[calibration],quotes);
  assert.equal(r.candidateCount,0);
  assert.equal(r.rejectionReasons.NO_POST_FORECAST_EXACT_QUOTES,1);
 }
 const pregame=[quote('DraftKings','ownerA',120,{eventStartTime:qStart,observedAt:now-1}),
  quote('FanDuel','ownerB',115,{eventStartTime:qStart,observedAt:now-1})];
 assert.equal(review([futureModel],[calibration],pregame).candidateCount,1);
});

test('model numeric evidence does not coerce booleans, arrays or strings',()=>{
 for(const run_count of [true,[500000],'500000',Number.MAX_SAFE_INTEGER+1]){
  const r=review([{...model,run_count}]);
  assert.equal(r.candidateCount,0);
  assert.equal(r.rejectionReasons.INVALID_STORED_RUN_COUNT,1);
 }
 for(const model_probability of [[.52],'.52',null,false,NaN]){
  const r=review([{...model,model_probability}]);
  assert.equal(r.candidateCount,0);
  assert.equal(r.rejectionReasons.INVALID_MODEL_PROBABILITY,1);
 }
});

test('validation assertion grade must be an exact supported string',()=>{
 for(const validationEvidenceGrade of [null,['QUALIFIED'],['VERIFIED'],true,{},'QUALIFIED ']){
  const r=review([{...model,feature_snapshot:JSON.stringify({...feature,validationEvidenceGrade})}]);
  assert.equal(r.candidateCount,0);
  assert.equal(r.rejectionReasons.VALIDATION_LAB_PROMOTION_NOT_EVIDENCED,1);
 }
});

test('conflicting latest target prices are rejected by the complete D1 evidence join',()=>{
 const quotes=[quote('DraftKings','ownerA',120),quote('DraftKings','ownerA',-200),quote('FanDuel','ownerB')];
 for(const input of [quotes,[...quotes].reverse()]){
  const r=review([model],[calibration],input);
  assert.equal(r.candidateCount,0);
  assert.equal(r.rejectionReasons.CONFLICTING_LATEST_TARGET_QUOTES,1);
 }
});

test('a newer unfavorable model correction supersedes an older positive edge in either input order',()=>{
 const correction={...model,id:8,model_probability:.30,created_at:new Date(now-45000).toISOString()};
 for(const models of [[model,correction],[correction,model]]){
  const r=review(models);
  assert.equal(r.candidateCount,0);
  assert.equal(r.rejectionReasons.SUPERSEDED_MODEL_RUN,1);
  assert.equal(r.modelsExamined,2);
  assert.equal(r.eligibleModels,1);
 }
});

test('invalid or unqualified latest model evidence cannot revive a superseded favorable forecast',()=>{
 for(const invalid of [
  {model_probability:null},{model_probability:'.52'},{run_count:0},
  {feature_snapshot:JSON.stringify({...feature,promotionEligible:false})},
  {feature_snapshot:JSON.stringify({...feature,eventStartTime:'not-a-date'})},
  {created_at:new Date(now+60000).toISOString()}
 ]){
  const correction={...model,id:8,created_at:new Date(now-45000).toISOString(),...invalid};
  for(const models of [[model,correction],[correction,model]]){
   const r=review(models);
   assert.equal(r.candidateCount,0,JSON.stringify(invalid));
   assert.equal(r.rejectionReasons.SUPERSEDED_MODEL_RUN,1);
  }
 }
});

test('the current model must have its own post-forecast quote evidence',()=>{
 const correction={...model,id:8,created_at:new Date(now-15000).toISOString()};
 for(const models of [[model,correction],[correction,model]]){
  const r=review(models);
  assert.equal(r.candidateCount,0);
  assert.equal(r.rejectionReasons.SUPERSEDED_MODEL_RUN,1);
  assert.equal(r.rejectionReasons.NO_POST_FORECAST_EXACT_QUOTES,1);
 }
});

test('timestamp-tied model revisions follow the latest trustworthy stored ID',()=>{
 const correction={...model,id:8,model_probability:.30};
 for(const models of [[model,correction],[correction,model]]){
  const r=review(models);
  assert.equal(r.candidateCount,0);
  assert.equal(r.rejectionReasons.SUPERSEDED_MODEL_RUN,1);
 }
 const favorable={...correction,id:9,model_probability:.55};
 const r=review([favorable,model,correction]);
 assert.equal(r.candidateCount,1);
 assert.equal(r.candidates[0].modelRunId,9);
 assert.equal(r.candidates[0].modelProbability,.55);
 assert.equal(r.rejectionReasons.SUPERSEDED_MODEL_RUN,2);
});

test('ambiguous model timestamps and conflicting copies fail closed while identical repeats count once',()=>{
 for(const id of [model.id,null,'8',1.5]){
  const correction={...model,id,model_probability:.30};
  for(const models of [[model,correction],[correction,model]]){
   const r=review(models);
   assert.equal(r.candidateCount,0);
   assert.equal(r.rejectionReasons.CONFLICTING_LATEST_MODEL_RUNS,1);
  }
 }
 const invalidTime={...model,id:8,created_at:'not-a-date'};
 for(const models of [[model,invalidTime],[invalidTime,model]]){
  const r=review(models);
  assert.equal(r.candidateCount,0);
  assert.equal(r.rejectionReasons.AMBIGUOUS_MODEL_RUN_RECENCY,1);
 }
 assert.equal(review([model,{...model}]).candidateCount,1);
});

test('model supersession keeps versions, sports, currencies, settlements, selections and outcomes separate',()=>{
 for(const changes of [
  {model_version:'model-v2'},{event_id:'nba:event-2'},{selection_key:'Away'},
  {feature_snapshot:JSON.stringify({...feature,sport:'NFL'})},
  {feature_snapshot:JSON.stringify({...feature,currency:'CAD'})},
  {feature_snapshot:JSON.stringify({...feature,settlementKey:'NBA_REGULATION_ONLY'})},
  {feature_snapshot:JSON.stringify({...feature,outcomes:['Home','Draw','Away']})}
 ]){
  const other={...model,id:8,model_probability:.30,created_at:new Date(now-45000).toISOString(),...changes};
  for(const models of [[model,other],[other,model]]){
   const r=review(models);
   assert.equal(r.candidateCount,1,JSON.stringify(changes));
   assert.equal(r.candidates[0].modelRunId,model.id);
   assert.equal(r.rejectionReasons.SUPERSEDED_MODEL_RUN,undefined);
  }
 }
});

test('different player prop lines, periods, players and statistics cannot supersede one another',()=>{
 const propFeature={...feature,settlementKey:'NBA_PLAYER_POINTS_FULL_GAME',outcomes:['Over','Under'],
  lineKey:'24.5',periodKey:'FULL',playerId:'p1',statKey:'points'};
 const propModel={...model,market_key:'player_points',selection_key:'Over',feature_snapshot:JSON.stringify(propFeature)};
 const quotes=['DraftKings','FanDuel'].map((book,i)=>quote(book,'owner'+i,120,{
  marketKey:'player_points',selection:'Over',settlementKey:propFeature.settlementKey,
  outcomes:propFeature.outcomes,lineKey:propFeature.lineKey,periodKey:propFeature.periodKey,
  playerId:propFeature.playerId,statKey:propFeature.statKey
 }));
 for(const change of [{lineKey:'25.5'},{periodKey:'FIRST_HALF'},{playerId:'p2'},{statKey:'assists'}]){
  const other={...propModel,id:8,model_probability:.30,created_at:new Date(now-45000).toISOString(),
   feature_snapshot:JSON.stringify({...propFeature,...change})};
  for(const models of [[propModel,other],[other,propModel]]){
   const r=review(models,[{...calibration,market_key:'player_points'}],quotes);
   assert.equal(r.candidateCount,1,JSON.stringify(change));
   assert.equal(r.candidates[0].modelRunId,propModel.id);
   assert.equal(r.rejectionReasons.SUPERSEDED_MODEL_RUN,undefined);
  }
 }
});

test('a newer unidentified contract blocks the affected model family until a later identified revision exists',()=>{
 const malformed={...model,id:8,created_at:new Date(now-45000).toISOString(),feature_snapshot:'not-json'};
 for(const models of [[model,malformed],[malformed,model]]){
  const r=review(models);
  assert.equal(r.candidateCount,0);
  assert.equal(r.rejectionReasons.MODEL_CONTRACT_REVISION_UNVERIFIED,1);
  assert.equal(r.rejectionReasons.INVALID_FEATURE_SNAPSHOT,1);
 }
 const recovered={...model,id:9,created_at:new Date(now-40000).toISOString()};
 const r=review([model,malformed,recovered]);
 assert.equal(r.candidateCount,1);
 assert.equal(r.candidates[0].modelRunId,recovered.id);
});

test('a malformed revision with explicit different contract dimensions cannot suppress unrelated evidence',()=>{
 for(const changed of [{sport:'NFL'},{currency:'CAD'},{settlementKey:'NBA_REGULATION_ONLY'},
  {outcomes:['Home','Draw','Away']}]){
  const partial={...feature,playerId:'',...changed};
  // Keep the changed dimension intact while invalidating another required identity dimension.
  if(changed.sport)delete partial.currency;else delete partial.sport;
  const other={...model,id:8,created_at:new Date(now-45000).toISOString(),feature_snapshot:JSON.stringify(partial)};
  const r=review([other,model]);
  assert.equal(r.candidateCount,1,JSON.stringify(changed));
  assert.equal(r.candidates[0].modelRunId,model.id);
  assert.equal(r.rejectionReasons.MODEL_CONTRACT_REVISION_UNVERIFIED,undefined);
 }
});

test('malformed supplied model axes cannot split revision identity then disappear during screening',()=>{
 for(const [axis,value] of [['periodKey',42],['lineKey',{}],['playerId',[]],['statKey','  ']]){
  for(const model_probability of [.30,.55]){
   const correction={...model,id:8,model_probability,created_at:new Date(now-45000).toISOString(),
    feature_snapshot:JSON.stringify({...feature,[axis]:value})};
   for(const models of [[model,correction],[correction,model]]){
    const r=review(models);
    assert.equal(r.candidateCount,0,`${axis} at probability ${model_probability}`);
    assert.equal(r.rejectionReasons.MODEL_CONTRACT_REVISION_UNVERIFIED,1);
    assert.equal(r.rejectionReasons.MODEL_MARKET_CONTRACT_INCOMPLETE,1);
   }
   assert.equal(review([correction]).candidateCount,0,`${axis} cannot qualify alone`);
  }
 }
 // Omitted axes and their valid straight-market defaults still identify one contract.
 const correction={...model,id:8,model_probability:.30,created_at:new Date(now-45000).toISOString(),
  feature_snapshot:JSON.stringify({...feature,lineKey:'STRAIGHT',periodKey:'FULL'})};
 assert.equal(review([model]).candidateCount,1);
 assert.equal(review([model,correction]).candidateCount,0);
 assert.equal(review([model,correction]).rejectionReasons.SUPERSEDED_MODEL_RUN,1);
});
