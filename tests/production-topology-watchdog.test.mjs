import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const watchdog=readFileSync(new URL('../src/lib/productionTopologyWatchdog.ts',import.meta.url),'utf8');
const cron=readFileSync(new URL('../src/app/api/cron/topology-watchdog/route.ts',import.meta.url),'utf8');
const operations=readFileSync(new URL('../src/app/api/operations/production-topology/route.ts',import.meta.url),'utf8');
const worker=readFileSync(new URL('../worker/index.ts',import.meta.url),'utf8');
const automation=readFileSync(new URL('../src/lib/automationHealth.ts',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/components/Dashboard.tsx',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/components/ProductionTopologyWatchdogPanel.tsx',import.meta.url),'utf8');
const testRoute=readFileSync(new URL('../src/app/api/testing/production-topology/route.ts',import.meta.url),'utf8');

test('V146 requires current certified Cloudflare primary and closed production commit',()=>{
 assert.match(watchdog,/convergence\?\.certified===true/);
 assert.match(watchdog,/closure\?\.closed===true/);
 assert.match(watchdog,/String\(convergence\?\.commitSha\|\|''\)===currentCommit/);
 assert.match(watchdog,/String\(closure\?\.commitSha\|\|''\)===currentCommit/);
 assert.match(watchdog,/primary\?\.exactMainCertified===true/);
 assert.match(watchdog,/primary\?\.hostedSmokePassed===true/);
 assert.match(watchdog,/primary\?\.platformReady===true/);
});

test('V146 watchdog keeps a healthy manual READY standby operational while gating failover on compatibility',()=>{
 assert.match(watchdog,/standby\?\.manualOnly===true/);
 assert.match(watchdog,/String\(standby\?\.state\|\|''\)\.toUpperCase\(\)==='READY'/);
 assert.match(watchdog,/const standbyReachable=Boolean/);
 assert.match(watchdog,/input\.standbyHealth\.httpStatus===200/);
 assert.match(watchdog,/const standbyReleaseCompatible=Boolean/);
 assert.match(watchdog,/input\.standbyHealth\.version===RELEASE\.appVersion/);
 assert.match(watchdog,/Number\(input\.standbyHealth\.migrationVersion\)===RELEASE\.migrationVersion/);
 assert.match(watchdog,/const ready=blockers\.length===0&&primaryCurrent&&standbyConfigured&&standbyReachable/);
 assert.match(watchdog,/const failoverReady=primaryCurrent&&standbyConfigured&&standbyReachable&&standbyReleaseCompatible/);
});

test('V146 never enables automatic standby promotion',()=>{
 assert.match(watchdog,/automaticPromotionAllowed:false/);
 assert.match(watchdog,/requiresHumanApproval:true/);
 assert.match(watchdog,/verify-current-standby-before-any-manual-promotion/);
 assert.match(testRoute,/automaticPromotionDisabled/);
});

test('V146 standby probe retries transient failures but stays bounded',()=>{
 assert.match(watchdog,/for\(let attempt=1;attempt<=3;attempt\+\+\)/);
 assert.match(watchdog,/response\.status>=500&&attempt<3/);
 assert.match(watchdog,/AbortSignal\.timeout\(8000\)/);
});

test('V146 hourly Cloudflare cron records topology watchdog health',()=>{
 assert.match(worker,/runTopologyCron/);
 assert.match(worker,/53/);
 assert.match(automation,/jobName:'topology-watchdog',maxGapHours:2/);
 assert.match(cron,/recordAutomationRun\('topology-watchdog'/);
 assert.match(cron,/status:report\.ready\?200:503/);
});

test('V146 operations surface is read-only and visible on the dashboard',()=>{
 assert.match(operations,/export async function GET/);
 assert.doesNotMatch(operations,/export async function POST/);
 assert.match(dashboard,/ProductionTopologyWatchdogPanel/);
 assert.match(panel,/AUTO FAILOVER/);
 assert.match(panel,/human approval required/);
});
