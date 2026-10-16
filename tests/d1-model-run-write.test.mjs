import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const s=readFileSync('worker/d1-model-runs.ts','utf8');
test('stored model-run writer requires bounded probabilities and real run counts',()=>{assert.match(s,/insertStoredModelRun/);assert.match(s,/INVALID_RUN_COUNT/);assert.match(s,/INVALID_MARKET_PROBABILITY|probability\(run.market_probability/);assert.match(s,/INVALID_FEATURE_SNAPSHOT_SIZE/);});
test('writer is append-only and not exposed by production Worker',()=>{assert.match(s,/INSERT INTO model_runs/);assert.doesNotMatch(s,/UPDATE model_runs|DELETE FROM model_runs/);assert.doesNotMatch(readFileSync('worker\/index.ts','utf8'),/insertStoredModelRun/);});
