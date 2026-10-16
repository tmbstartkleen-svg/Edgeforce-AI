import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const route=readFileSync('worker/d1-pilot-model-history.ts','utf8');
test('pilot history authenticates before querying D1',()=>{assert.ok(route.indexOf('UNAUTHORIZED')<route.indexOf('readModelRuns(env.INTELLIGENCE_DB'));assert.match(route,/AUTH_NOT_CONFIGURED/);assert.match(route,/no-store/);});
test('history has bounded requests, clear provenance, and no production route',()=>{assert.match(route,/INVALID_LIMIT/);assert.match(route,/productionPrimary:false/);assert.match(route,/isLiveInference:false/);assert.match(readFileSync('worker/d1-standalone.ts','utf8'),/d1PilotModelHistory/);assert.doesNotMatch(readFileSync('worker/index.ts','utf8'),/d1-pilot-model-history/);});
