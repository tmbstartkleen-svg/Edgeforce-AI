import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const preflight=readFileSync(new URL('../scripts/production-db-preflight.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/deploy-cloudflare.yml',import.meta.url),'utf8');
test('production preflight uses read-only probe and preserves migration gate',()=>{
 assert.match(preflight,/select 1 as healthy/);
 assert.doesNotMatch(preflight,/drop table|truncate table|delete from|alter table|create table/i);
 assert.match(workflow,/node scripts\/production-db-preflight\.mjs/);
 assert.match(workflow,/Apply Neon\/Postgres migrations through current release/);
 assert.match(workflow,/npm run migrate/);
 assert.ok(workflow.indexOf('node scripts/production-db-preflight.mjs') < workflow.indexOf('npm run build:vinext'));
});
test('quota diagnostic is actionable without emitting secret values',()=>{
 assert.match(preflight,/53000/);
 assert.match(preflight,/DATABASE_PREFLIGHT_QUOTA_BLOCKED/);
 assert.doesNotMatch(preflight,/console\.error\(error\)/);
});
