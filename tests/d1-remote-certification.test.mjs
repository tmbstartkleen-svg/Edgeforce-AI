import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const workflow=fs.readFileSync('.github/workflows/provision-d1.yml','utf8');
test('D1 provisioning confirms the actual remote schema before claiming success',()=>{
 assert.match(workflow,/workflow_dispatch:/);
 assert.match(workflow,/refs\/heads\/main/);
 assert.match(workflow,/trap 'rm -f \.d1-provision\.wrangler\.json' EXIT/);
 assert.match(workflow,/\/d1\/database\/\$D1_DATABASE_ID\/query/);
 assert.match(workflow,/sqlite_master/);
 assert.match(workflow,/intelligence_observations/);
 assert.match(workflow,/intelligence_sources/);
 assert.match(workflow,/D1 remote schema certified/);
});
