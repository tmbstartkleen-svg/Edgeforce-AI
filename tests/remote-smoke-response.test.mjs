import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseSmokeJson,shouldRetryDegradedHttp} from '../scripts/remote-smoke-response.mjs';

const degraded=new Set(['/api/parlays?size=2&view=today']);

test('V145 retries transient 502/503/504 only for degraded-allowed recommendation paths',()=>{
 for(const status of [502,503,504])assert.equal(shouldRetryDegradedHttp('/api/parlays?size=2&view=today',status,degraded),true);
 assert.equal(shouldRetryDegradedHttp('/api/parlays?size=2&view=today',500,degraded),false);
 assert.equal(shouldRetryDegradedHttp('/api/health',503,degraded),false);
});

test('V145 smoke JSON parser reports non-JSON HTTP response without raw SyntaxError',()=>{
 assert.deepEqual(parseSmokeJson('/x',200,'{"ok":true}'),{ok:true});
 assert.throws(()=>parseSmokeJson('/api/parlays?size=2&view=today',503,'<!DOCTYPE html><html>down</html>'),/returned non-JSON HTTP 503/);
});
