import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';

const source = fs.readFileSync(new URL('../src/lib/edgeValue.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const {calculateEdgeValue, breakEvenProbability, fairOddsFromProbability} = await import('data:text/javascript;base64,' + Buffer.from(javascript).toString('base64'));

test('New Mexico -117 and 57.1% returns correct edge and ROI', () => {
  const r = calculateEdgeValue(-117, 0.571);
  assert.ok(Math.abs(r.breakEvenProbability * 100 - 53.9170507) < 1e-5);
  assert.ok(Math.abs(r.probabilityEdgePp - 3.1829493) < 1e-5);
  assert.ok(Math.abs(r.expectedRoiPercent - 5.9034188) < 0.001);
  assert.equal(r.confidence, 'unverified-model');
});

test('positive odds and fair odds', () => {
  assert.equal(breakEvenProbability(150), 0.4);
  assert.equal(calculateEdgeValue(100, 0.6).expectedRoiPercent, 20);
  assert.equal(fairOddsFromProbability(0.5), -100);
});

test('high winning probability can have negative expected ROI', () => {
  const r = calculateEdgeValue(-2500, 0.95);
  assert.ok(r.probabilityEdgePp < 0);
  assert.ok(Math.abs(r.expectedRoiPercent + 1.2) < 1e-10);
});

test('invalid probabilities or American prices are rejected', () => {
  for (const o of [0, -99, 99, NaN, Infinity, 100.5]) {
    assert.throws(() => calculateEdgeValue(o, 0.6), RangeError);
  }
  for (const p of [-0.01, 1.01, NaN, Infinity]) {
    assert.throws(() => calculateEdgeValue(-117, p), RangeError);
  }
});
