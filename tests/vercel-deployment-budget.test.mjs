import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/deploy-production.yml',import.meta.url),'utf8');

test('Vercel deployment budget guard runs before build and deploy',()=>{
 const guard=workflow.indexOf('Check Vercel 24h deployment budget');
 const build=workflow.indexOf('Build staged production artifact');
 const deploy=workflow.indexOf('Deploy prebuilt remediation candidate');
 assert.ok(guard>=0);
 assert.ok(build>guard);
 assert.ok(deploy>guard);
});

test('deployment budget guard counts trailing 24h and fails before consuming another deployment',()=>{
 assert.match(workflow,/SINCE_MS=.*86400/);
 assert.match(workflow,/api\.vercel\.com\/v6\/deployments/);
 assert.match(workflow,/Vercel deployments in trailing 24h/);
 assert.match(workflow,/COUNT.*-ge.*MAX/);
});

test('deployment budget guard can be disabled after plan upgrade',()=>{
 assert.match(workflow,/VERCEL_DEPLOYMENT_BUDGET_MAX: "90"/);
 assert.match(workflow,/if \[ "\$MAX" -eq 0 \]/);
});
