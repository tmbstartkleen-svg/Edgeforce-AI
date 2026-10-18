import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../worker/d1-source-freshness-agent.ts',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../worker/d1-standalone.ts',import.meta.url),'utf8');
test('pilot freshness endpoint is authenticated and read-only',()=>{assert.match(source,/CRON_SECRET\.length<32/);assert.match(source,/Authorization/);assert.match(worker,/sourceFreshnessRoute\(request,env\)/);assert.doesNotMatch(source,/\b(?:DROP|INSERT|UPDATE|DELETE|ALTER|CREATE)\s+(?:TABLE|INTO|FROM)/i);});
test('no observed prices never qualify as independently validated edge',()=>{for(const status of ['NO_OBSERVATIONS','STALE','FUTURE_TIMESTAMP','DISABLED'])assert.ok(source.includes(status));assert.match(source,/upstreamsIndependentlyAuthenticated:false/);assert.match(source,/modelProbabilityVerified:false/);assert.match(source,/cutoverAuthorized:false/);});
