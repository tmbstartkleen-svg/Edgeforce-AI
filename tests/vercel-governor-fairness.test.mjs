import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const config=JSON.parse(readFileSync(new URL('../config/vercel-team-governor.json',import.meta.url),'utf8'));
const planner=readFileSync(new URL('../scripts/team-vercel-governor.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/team-vercel-governor.yml',import.meta.url),'utf8');
const manual=readFileSync(new URL('../.github/workflows/team-vercel-manual-release.yml',import.meta.url),'utf8');
const telemetry=readFileSync(new URL('../src/lib/vercelGovernorTelemetry.ts',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/components/VercelGovernorPanel.tsx',import.meta.url),'utf8');
const route=readFileSync(new URL('../src/app/api/operations/vercel-governor/route.ts',import.meta.url),'utf8');
const migration=readFileSync(new URL('../db/v117.sql',import.meta.url),'utf8');

test('V142 fair shares partition normal automation without consuming emergency reserve',()=>{
  assert.equal(config.projects.reduce((sum,p)=>sum+p.normalBudgetShare,0),84);
  assert.equal(config.softCap,84);
  assert.equal(config.hardCap,90);
  assert.equal(config.emergencyReserve,6);
  assert.match(planner,/if\(usage<softCap&&slots>0\)/);
  assert.doesNotMatch(planner,/hardCap-usage.*selected/);
});

test('V142 recovered slots prefer under-share work and bound borrowed capacity',()=>{
  assert.match(planner,/const underShare=projects\.filter/);
  assert.match(planner,/const overShare=projects\.filter/);
  assert.match(planner,/const ranked=\[\.\.\.underShare,\.\.\.overShare\]/);
  assert.match(planner,/maxBorrowedActionsPerRun/);
  assert.match(planner,/borrow unused normal capacity because no under-share pending project needs this slot/);
});

test('V142 fairness combines priority, aging, share credit, and over-share penalty',()=>{
  assert.match(planner,/project\.priority\?\?0/);
  assert.match(planner,/agingScore/);
  assert.match(planner,/underBudgetScore/);
  assert.match(planner,/overBudgetPenalty/);
  assert.match(planner,/fairnessScore/);
});

test('V142 workflow publishes queue evidence and deployment allocation metadata',()=>{
  assert.match(workflow,/Queue \*\*#\\\(\.queueRank\)\*\*/);
  assert.match(workflow,/governorQueueRank/);
  assert.match(workflow,/governorFairnessScore/);
  assert.match(workflow,/governorBudgetState/);
  assert.match(workflow,/governorBorrowedCapacity/);
  assert.match(workflow,/deploymentGovernor:"edgeforce-v142"/);
});

test('V142 persists and displays queue allocation evidence',()=>{
  assert.match(migration,/queue_rank int/);
  assert.match(migration,/fairness_score numeric/);
  assert.match(migration,/normal_budget_share int/);
  assert.match(migration,/borrowed_capacity boolean/);
  assert.match(telemetry,/normalBudgetShare/);
  assert.match(telemetry,/fairnessScore/);
  assert.match(telemetry,/queueRank/);
  assert.match(panel,/VERCEL TEAM GOVERNOR/);
  assert.match(panel,/BORROWED/);
  assert.match(panel,/score \{row\.fairnessScore/);
  assert.match(route,/x-edgeforce-governor-telemetry':'v144/);
});

test('V142 leaves V141 emergency manual release hard cap intact',()=>{
  assert.match(manual,/NORMAL_CAP: "84"/);
  assert.match(manual,/HARD_CAP: "90"/);
  assert.match(manual,/Hard-cap bypass: \*\*not permitted\*\*/);
});
