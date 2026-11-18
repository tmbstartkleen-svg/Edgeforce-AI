import test from 'node:test';
import assert from 'node:assert/strict';
import {runSelectedGameResearch} from '../src/lib/gameResearchMonteBridge.ts';

const market = {
  id:'nba-game-1-home-ml',sport:'NBA',league:'NBA',event:'Home vs Away',
  selection:'Home',market:'moneyline',startTime:'2026-11-19T00:00:00Z',
  home:'Home',away:'Away',odds:-120,marketProb:0.545,modelProb:0.6,
  confidence:0.8,sourceAgeMin:1,period:'PM',sourceEventId:'nba-game-1'
};
const base = {
  sport:'NBA',eventId:'nba-game-1',modelVersion:'model-v1',seed:1234,trials:500000,
  forecasts:[{
    market,modelGeneratedAt:'2026-11-18T20:00:00Z',
    injuryCheckedAt:'2026-11-18T19:30:00Z',
    rosterCheckedAt:'2026-11-18T19:35:00Z',
    calibrationStatus:'VALIDATED',factorLoading:0.4,
    injurySource:'official-injury-report',rosterSource:'official-team-roster',calibrationEvidenceId:'holdout-2026-v1'
  }]
};

test('game research requires exact event and sport',()=>{
  assert.deepEqual(runSelectedGameResearch({...base,eventId:'different'}).reasons,['EVENT_ID_MISMATCH']);
  assert.ok(runSelectedGameResearch({...base,sport:'CFB'}).reasons.includes('SPORT_MISMATCH'));
});
test('blocks missing calibration and missing correlation',()=>{
  const result=runSelectedGameResearch({...base,forecasts:[{...base.forecasts[0],calibrationStatus:'UNCALIBRATED',factorLoading:null}]});
  assert.equal(result.status,'BLOCKED');
  assert.ok(result.reasons.includes('UNCALIBRATED_MODEL'));
  assert.ok(result.reasons.includes('MISSING_VERIFIED_CORRELATION'));
});
test('blocks postgame forecasts and future injury observations',()=>{
  const result=runSelectedGameResearch({...base,forecasts:[{...base.forecasts[0],injuryCheckedAt:'2026-11-18T21:00:00Z'}]});
  assert.ok(result.reasons.includes('INVALID_PREGAME_EVIDENCE_ORDER'));
});
test('runs explicitly selected research game, never promotes a betting signal', {timeout:90000},()=>{
  const result=runSelectedGameResearch(base);
  assert.equal(result.status,'RESEARCH_ONLY');
  assert.equal(result.result.completedTrials,500000);
  assert.ok(result.warnings.includes('NOT_A_WAGERING_SIGNAL'));
});

test('blocks unproven evidence provenance and invalid simulation settings',()=>{
  const forecast={...base.forecasts[0],injurySource:'',rosterSource:'',calibrationEvidenceId:''};
  const result=runSelectedGameResearch({...base,seed:1.5,trials:10,forecasts:[forecast]});
  assert.equal(result.status,'BLOCKED');
  assert.ok(result.reasons.includes('MISSING_SOURCE_PROVENANCE'));
  assert.ok(result.reasons.includes('MISSING_CALIBRATION_EVIDENCE'));
  assert.ok(result.reasons.includes('INVALID_SIMULATION_CONFIGURATION'));
});
