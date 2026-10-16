import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const c=readFileSync('worker/d1-sports-schema-coverage.ts','utf8');
test('coverage requires authentication before any D1 query',()=>{assert.ok(c.indexOf('UNAUTHORIZED')<c.indexOf('env.INTELLIGENCE_DB.prepare('));assert.match(c,/AUTH_NOT_CONFIGURED/);assert.match(c,/no-store/);});
test('coverage checks all baseline tables but cannot authorize cutover',()=>{for(const name of ['teams','athletes','events','market_snapshots','model_runs','bet_results','calibration_metrics'])assert.ok(c.includes("'"+name+"'"));assert.match(c,/historyMigrated:false/);assert.match(c,/queryParityCertified:false/);assert.match(c,/productionPrimary:false/);assert.match(readFileSync('worker/d1-standalone.ts','utf8'),/d1SportsSchemaCoverage/);assert.doesNotMatch(readFileSync('worker/index.ts','utf8'),/d1-sports-schema-coverage/);});
