import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../worker/d1-standalone.ts',import.meta.url),'utf8');
const config=JSON.parse(readFileSync(new URL('../wrangler.d1-pilot.jsonc',import.meta.url),'utf8'));
test('source freshness heartbeat is opt-in and hourly',()=>{assert.equal(config.vars.SOURCE_FRESHNESS_SCHEDULE_ENABLED,'false');assert.deepEqual(config.triggers.crons,['0 * * * *']);assert.match(worker,/SOURCE_FRESHNESS_SCHEDULE_ENABLED==='true'/);assert.match(worker,/assessSourceFreshness\(env\)/);});
test('source heartbeat never activates odds collection or writes',()=>{assert.equal(config.vars.SPORTS_D1_WRITE_ENABLED,'false');assert.equal(config.vars.SPORTS_SCORE_COLLECT_ENABLED,'false');assert.match(worker,/source freshness summary/);});
