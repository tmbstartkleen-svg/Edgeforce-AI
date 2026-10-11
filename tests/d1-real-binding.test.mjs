import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
test('EdgeForce binds only the certified provisioned D1 database',()=>{
 const d1=config.d1_databases;
 assert.equal(d1.length,1);
 assert.equal(d1[0].binding,'INTELLIGENCE_DB');
 assert.equal(d1[0].database_name,'edgeforce-intelligence');
 assert.equal(d1[0].database_id,'335bcda1-8603-4bdf-8e27-acefdf0d8069');
 assert.notEqual(config.vars?.INTELLIGENCE_D1_WRITE_ENABLED,'true');
});
