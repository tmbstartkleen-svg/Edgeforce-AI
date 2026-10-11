import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('D1 pilot isolated from Neon and production Worker',()=>{
 const config=JSON.parse(fs.readFileSync('wrangler.d1-pilot.jsonc','utf8'));
 const workflow=fs.readFileSync('.github/workflows/deploy-d1-pilot.yml','utf8');
 assert.equal(config.name,'edgeforce-d1-pilot');
 assert.equal(config.d1_databases[0].database_id,'335bcda1-8603-4bdf-8e27-acefdf0d8069');
 assert.equal(config.vars.INTELLIGENCE_D1_WRITE_ENABLED,'false');
 assert.doesNotMatch(workflow,/npm run migrate/);
 assert.doesNotMatch(workflow,/secrets\.DATABASE_URL/);
 assert.match(workflow,/wrangler deploy --config wrangler.d1-pilot.jsonc/);
});
