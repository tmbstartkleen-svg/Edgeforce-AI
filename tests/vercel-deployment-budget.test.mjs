import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/deploy-production.yml',import.meta.url),'utf8');
const budgetStep=()=>{
 const marker='      - name: Check Vercel 24h deployment budget\n';
 const start=workflow.indexOf(marker);
 assert.notEqual(start,-1,'deployment budget step must exist');
 const end=workflow.indexOf('\n      - ',start+marker.length);
 return workflow.slice(start,end<0?undefined:end);
};

test('Vercel deployment budget guard runs before build and deploy',()=>{
 const guard=workflow.indexOf('Check Vercel 24h deployment budget');
 const build=workflow.indexOf('Build staged production artifact');
 const deploy=workflow.indexOf('Deploy prebuilt remediation candidate');
 assert.ok(guard>=0);
 assert.ok(build>guard);
 assert.ok(deploy>guard);
});

test('deployment budget guard counts team-wide trailing 24h usage before consuming another deployment',()=>{
 const guard=budgetStep();
 assert.match(guard,/SINCE_MS=.*86400/);
 assert.match(guard,/api\.vercel\.com\/v6\/deployments\?teamId=\$VERCEL_ORG_ID&limit=100/);
 assert.doesNotMatch(guard,/projectId=\$VERCEL_PROJECT_ID/);
 assert.match(guard,/Vercel team deployments in trailing 24h/);
 assert.match(guard,/COUNT.*-ge.*MAX/);
});

test('deployment budget guard can be disabled after plan upgrade',()=>{
 const guard=budgetStep();
 assert.match(guard,/VERCEL_DEPLOYMENT_BUDGET_MAX: "90"/);
 assert.match(guard,/if \[ "\$MAX" -eq 0 \]/);
});
