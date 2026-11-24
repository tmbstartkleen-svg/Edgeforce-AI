import test from 'node:test';
import assert from 'node:assert/strict';
import {runCorrelatedGameSimulation} from '../src/lib/correlatedGameSimulation.ts';

const base = {
  eventId: 'synthetic-nba-event', modelVersion: 'research-test-v1', seed: 1729,
  trials: 500000,
  markets: [
    {id: 'team-win', probability: 0.6, factorLoading: 0.7},
    {id: 'player-over', probability: 0.55, factorLoading: 0.7}
  ]
};

test('500k trials complete and reproduce exactly from the same seed', {timeout: 90000}, () => {
  const a = runCorrelatedGameSimulation(base);
  const b = runCorrelatedGameSimulation(base);
  assert.deepEqual(a, b);
  assert.equal(a.completedTrials, 500000);
  assert.equal(a.requestedTrials, 500000);
  assert.equal(a.status, 'RESEARCH_ONLY_UNCALIBRATED');
  assert.ok(Math.abs(a.marketHits['team-win'] / a.completedTrials - 0.6) < 0.006);
  assert.ok(Math.abs(a.marketHits['player-over'] / a.completedTrials - 0.55) < 0.006);
  assert.ok(a.maxStandardError < 0.001);
  const observedJoint = a.pairHits[JSON.stringify(['team-win', 'player-over'])] / a.completedTrials;
  assert.ok(observedJoint > 0.6 * 0.55 + 0.02, 'positive factor loading must create positive dependence');
});

test('negative loading reduces joint hit probability', {timeout: 90000}, () => {
  const a = runCorrelatedGameSimulation({...base, markets: [base.markets[0], {...base.markets[1], factorLoading: -0.7}]});
  const observedJoint = a.pairHits[JSON.stringify(['team-win', 'player-over'])] / a.completedTrials;
  assert.ok(observedJoint < 0.6 * 0.55 - 0.02);
});

test('invalid trials, duplicate markets and invalid model probabilities fail closed', () => {
  assert.throws(() => runCorrelatedGameSimulation({...base, trials: 123}), /Unsupported trial count/);
  assert.throws(() => runCorrelatedGameSimulation({...base, markets: [base.markets[0], base.markets[0]]}), /duplicate market/);
  assert.throws(() => runCorrelatedGameSimulation({...base, markets: [{id:'bad', probability:1.5, factorLoading:0}]}), /Invalid model probability/);
});
