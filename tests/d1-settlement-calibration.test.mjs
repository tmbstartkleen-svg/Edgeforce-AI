import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const code=readFileSync('worker/d1-settlement-calibration.ts','utf8');
test('settlement reader preserves stored provenance and bounds',()=>{assert.match(code,/WHERE event_id=\? ORDER BY id DESC LIMIT \?/);assert.match(code,/STORED_SETTLEMENT/);assert.match(code,/INVALID_LIMIT/)});
test('calibration reader scoped by model and isolated',()=>{assert.match(code,/WHERE model_version=\? ORDER BY created_at DESC,id DESC LIMIT \?/);assert.match(code,/STORED_CALIBRATION/);assert.doesNotMatch(readFileSync('worker/index.ts','utf8'),/d1-settlement-calibration/);});
