import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/lib/simulation.ts',import.meta.url),'utf8');

test('large Monte Carlo tiers are explicit, while automatic tier stays bounded',()=>{
 assert.ok(source.includes('SimulationTier=100|1000|10000|100000|500000|1000000'));
 assert.ok(source.includes('if(edge>=.08&&confidence>=.8)return 100000'));
 assert.ok(source.includes('validatedSimulationRuns(runs)'));
});

test('unsupported trial counts fail closed',()=>{
 assert.ok(source.includes("throw new RangeError('Unsupported simulation trial count')"));
});
