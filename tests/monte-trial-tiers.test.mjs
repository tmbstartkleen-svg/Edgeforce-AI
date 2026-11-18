import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/lib/simulation.ts',import.meta.url),'utf8');

test('explicit 500k and 1m tiers are supported without changing automatic default',()=>{
 assert.match(source,/SimulationTier=100\\|1000\\|10000\\|100000\\|500000\\|1000000/);
 assert.match(source,/if\\(edge>=\\.08&&confidence>=\\.8\\)return 100000/);
 assert.match(source,/validatedSimulationRuns\\(runs\\)/);
});

test('unsupported requested counts fail closed',()=>{
 assert.match(source,/throw new RangeError\\('Unsupported simulation trial count'\\)/);
});
