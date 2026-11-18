import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../src/lib/correlatedGameSimulation.ts', import.meta.url), 'utf8');

test('correlated engine records actual completed trials and research status', () => {
  assert.ok(source.includes('completedTrials: input.trials'));
  assert.ok(source.includes("status: 'RESEARCH_ONLY_UNCALIBRATED'"));
  assert.ok(source.includes('maxStandardError'));
  assert.ok(source.includes('pairHits'));
});

test('simulation requires valid input and explicit 500k or 1m tiers', () => {
  assert.ok(source.includes('input.trials !== 500000 && input.trials !== 1000000'));
  assert.ok(source.includes('ids.has(m.id)'));
  assert.ok(source.includes('Math.abs(m.factorLoading) > 1'));
});
