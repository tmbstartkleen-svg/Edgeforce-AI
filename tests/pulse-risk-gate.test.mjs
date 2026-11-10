import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePulseCandidate,decimalOdds} from '../src/lib/intelligence-core/pulse-risk-gate.mjs';

const now = Date.parse('2026-10-26T14:00:00Z');
const base = {
  americanOdds: 120,
  quoteObservedAt: now - 30_000,
  modelCalibrated: true,
  outOfSampleVerified: true,
  sourceAudited: true,
  lineupStatus: 'CONFIRMED',
  scenarios: [
    {name:'baseline',weight:0.7,probability:0.62},
    {name:'lineup risk',weight:0.3,probability:0.57},
  ],
};

test('American odds and break-even conversion are exact', () => {
  assert.equal(decimalOdds(120), 2.2);
  assert.equal(decimalOdds(-200), 1.5);
});

test('candidate only passes when scenario-adjusted edge clears threshold and evidence is complete', () => {
  const result = evaluatePulseCandidate(base, {now,minEdge:0.03,scenarioRiskPenalty:0.25});
  assert.equal(result.status,'CANDIDATE_FOR_REVIEW');
  assert.equal(result.evidenceReady,true);
  assert.equal(result.automatedBettingEnabled,false);
  assert.ok(result.scenarioAdjustedProbability < result.scenarioMeanProbability);
  assert.ok(result.edge >= 0.03);
});

test('stale quotes fail closed even when central scenario probability looks strong', () => {
  const result = evaluatePulseCandidate({...base,quoteObservedAt:now-60*60*1000},{now});
  assert.equal(result.status,'PASS');
  assert.equal(result.reason,'REQUIRED_EVIDENCE_MISSING');
  assert.equal(result.evidence.quoteFresh,false);
});

test('uncalibrated or non-holdout model cannot produce a candidate', () => {
  const result = evaluatePulseCandidate({...base,modelCalibrated:false},{now});
  assert.equal(result.status,'PASS');
  assert.equal(result.evidence.modelCalibrated,false);
});

test('thin positive edge is a watchlist, not an actionable recommendation', () => {
  const result = evaluatePulseCandidate({...base,scenarios:[
    {weight:0.7,probability:0.47},{weight:0.3,probability:0.45},
  ]},{now,minEdge:0.03,scenarioRiskPenalty:0.25});
  assert.equal(result.status,'WATCHLIST');
  assert.ok(result.edge > 0 && result.edge < 0.03);
});

test('scenario weights must sum to one', () => {
  assert.throws(()=>evaluatePulseCandidate({...base,scenarios:[
    {weight:0.5,probability:0.7},{weight:0.4,probability:0.6},
  ]},{now}),/SCENARIO_WEIGHTS_MUST_SUM_TO_ONE/);
});

test('invalid scenarios are rejected', () => {
  assert.throws(()=>evaluatePulseCandidate({...base,scenarios:[
    {weight:0.7,probability:1.2},{weight:0.3,probability:0.6},
  ]},{now}),/INVALID_PULSE_SCENARIO/);
});
