import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const code=readFileSync('worker/d1-model-runs.ts','utf8');
test('model reads are event-scoped, bounded, and provenance-preserving',()=>{assert.match(code,/WHERE event_id=\? ORDER BY created_at DESC,id DESC LIMIT \?/);assert.match(code,/INVALID_STORED_PROBABILITY/);assert.match(code,/isLiveInference:false/);});
test('not wired to production or pilot routes',()=>{assert.doesNotMatch(readFileSync('worker/index.ts','utf8'),/d1-model-runs/);assert.doesNotMatch(readFileSync('worker/d1-standalone.ts','utf8'),/d1-model-runs/);});
