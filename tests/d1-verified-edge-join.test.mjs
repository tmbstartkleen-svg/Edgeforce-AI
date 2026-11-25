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
