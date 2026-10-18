import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const worker=fs.readFileSync(new URL('../worker/d1-storage-steward.ts',import.meta.url),'utf8');
const standalone=fs.readFileSync(new URL('../worker/d1-standalone.ts',import.meta.url),'utf8');
const config=JSON.parse(fs.readFileSync(new URL('../wrangler.d1-pilot.jsonc',import.meta.url),'utf8'));
test('storage steward remains isolated and read-only',()=>{
 assert.equal(config.name,'edgeforce-d1-pilot');
 assert.equal(config.vars.STORAGE_STEWARD_SCHEDULE_ENABLED,'false');
 assert.equal(config.vars.INTELLIGENCE_D1_WRITE_ENABLED,'false');
 assert.match(worker,/sqlite_master/);
 assert.doesNotMatch(worker,/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\s+(INTO|FROM|TABLE)/i);
});
test('no public data exfiltration and maintenance routes demand a strong secret',()=>{
 assert.match(worker,/expected\.length<32/);
 assert.match(standalone,/storageStewardRoute\(request,env\)/);
 assert.match(standalone,/STORAGE_STEWARD_SCHEDULE_ENABLED!=='true'/);
 assert.deepEqual(config.triggers.crons,['0 * * * *']);
});
