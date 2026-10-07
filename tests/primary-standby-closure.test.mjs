import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const topology=readFileSync(new URL('../src/lib/releasePlatformConvergence.ts',import.meta.url),'utf8');
const closure=readFileSync(new URL('../src/lib/finalProductionClosure.ts',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/deploy-cloudflare.yml',import.meta.url),'utf8');
const vercelWorkflow=readFileSync(new URL('../.github/workflows/deploy-production.yml',import.meta.url),'utf8');
const topologyPanel=readFileSync(new URL('../src/components/PlatformConvergencePanel.tsx',import.meta.url),'utf8');
const closurePanel=readFileSync(new URL('../src/components/FinalProductionClosurePanel.tsx',import.meta.url),'utf8');
const topologyTest=readFileSync(new URL('../src/app/api/testing/platform-convergence/route.ts',import.meta.url),'utf8');
const closureTest=readFileSync(new URL('../src/app/api/testing/final-closure/route.ts',import.meta.url),'utf8');

test('V145 accepts real Cloudflare and Vercel HTTPS topology URLs',()=>{
 assert.match(topology,/new URL\(String\(value\|\|'\'\)\)/);
 assert.match(topology,/url\.protocol==='https:'/);
 assert.doesNotMatch(topology,/\^https/);
});

test('V145 topology requires certified Cloudflare primary and healthy manual Vercel standby',()=>{
 assert.match(topology,/cloudflare-primary-vercel-standby/);
 assert.match(topology,/exact-main certification did not pass/);
 assert.match(topology,/Cloudflare hosted smoke did not pass/);
 assert.match(topology,/Vercel standby health check failed/);
 assert.match(topology,/Vercel standby is not configured as manual-only/);
 assert.match(topology,/Vercel standby deployment is not READY/);
});

test('V145 standby commit drift is evidence, not a topology blocker',()=>{
 assert.match(topology,/commitDrift:Boolean\(standby\.commitSha&&standby\.commitSha!==input\.commitSha\)/);
 assert.doesNotMatch(topology,/standby.*commit.*mismatch.*blockers/i);
 assert.match(closure,/standbyCommitDrift:Boolean/);
 assert.match(topologyTest,/standbyCommitDriftAllowed/);
 assert.match(closureTest,/standbyDriftAllowed/);
});

test('V145 Cloudflare workflow inspects Vercel standby without creating a deployment',()=>{
 assert.match(workflow,/Verify Vercel manual standby without deploying/);
 assert.match(workflow,/api\.vercel\.com\/v4\/aliases\/\$VERCEL_PRODUCTION_ALIAS/);
 assert.match(workflow,/api\.vercel\.com\/v13\/deployments\/\$STANDBY_ID/);
 assert.match(workflow,/https:\/\/\$VERCEL_PRODUCTION_ALIAS\/api\/health/);
 assert.match(workflow,/manualOnly:true/);
 assert.match(workflow,/topology:"cloudflare-primary-vercel-standby"/);
 assert.doesNotMatch(workflow,/vercel deploy --prod/);
});

test('V145 final closure derives release gates from primary standby topology',()=>{
 assert.match(closure,/const primaryStandby=topologyEvidence\?\.topology==='cloudflare-primary-vercel-standby'/);
 assert.match(closure,/primary\.exactMainCertified/);
 assert.match(closure,/primary\.hostedSmokePassed/);
 assert.match(closure,/standby\.healthy===true/);
 assert.match(closure,/standby\.manualOnly===true/);
 assert.match(closure,/String\(standby\.state\|\|''\)\.toUpperCase\(\)==='READY'/);
 assert.match(closure,/Cloudflare primary and Vercel manual standby topology is not ready/);
});

test('V145 Vercel remains manual disaster recovery only',()=>{
 assert.match(vercelWorkflow,/on:\n  workflow_dispatch:/);
 assert.doesNotMatch(vercelWorkflow,/push:\n\s+branches: \[main\]/);
 assert.match(workflow,/Closure policy: Cloudflare current \+ Vercel standby healthy; standby commit drift is allowed/);
});

test('V145 operator surfaces describe primary standby instead of same-commit dual active',()=>{
 assert.match(topologyPanel,/Cloudflare Production \+ Vercel Disaster Recovery/);
 assert.match(topologyPanel,/drift allowed/);
 assert.match(closurePanel,/Primary \/ Standby Release Certificate/);
 assert.match(closurePanel,/Standby commit drift is expected until failover/);
});
