import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {evaluateReleaseBacklog,REQUIRED_MAIN_WORKFLOWS} from '../scripts/edgeforce-release-backlog.mjs';

const cloudflare=readFileSync(new URL('../.github/workflows/verify-cloudflare.yml',import.meta.url),'utf8');
const governor=readFileSync(new URL('../.github/workflows/team-vercel-governor.yml',import.meta.url),'utf8');
const planner=readFileSync(new URL('../scripts/team-vercel-governor.mjs',import.meta.url),'utf8');
const telemetry=readFileSync(new URL('../src/lib/edgeforceReleaseBacklog.ts',import.meta.url),'utf8');
const route=readFileSync(new URL('../src/app/api/operations/vercel-governor/route.ts',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/components/VercelGovernorPanel.tsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../db/v118.sql',import.meta.url),'utf8');

const now=1_800_000_000_000;
const compare={
  totalCommits:3,
  commits:[
    {sha:'a'.repeat(40),committedAt:new Date(now-3_600_000).toISOString(),message:'one'},
    {sha:'b'.repeat(40),committedAt:new Date(now-2_400_000).toISOString(),message:'two'},
    {sha:'c'.repeat(40),committedAt:new Date(now-1_200_000).toISOString(),message:'three'}
  ]
};
const successRuns=sha=>REQUIRED_MAIN_WORKFLOWS.map(name=>({headSha:sha,name,status:'completed',conclusion:'success'}));

test('V143 exact main SHA is certified only when both required main workflows pass',()=>{
  const runs=[...successRuns('a'.repeat(40)),...successRuns('b'.repeat(40)),...successRuns('c'.repeat(40))];
  const backlog=evaluateReleaseBacklog({
    compare,
    runs,
    liveSha:'0'.repeat(40),
    headSha:'c'.repeat(40),
    now
  });
  assert.equal(backlog.backlogDepth,3);
  assert.equal(backlog.certifiedBacklogDepth,3);
  assert.equal(backlog.newestCertifiedSha,'c'.repeat(40));
  assert.equal(backlog.headCertified,true);
  assert.equal(backlog.catchUpEligible,true);
});

test('V143 fails closed when the current main SHA lacks Cloudflare exact-main evidence',()=>{
  const runs=[
    ...successRuns('a'.repeat(40)),
    ...successRuns('b'.repeat(40)),
    {headSha:'c'.repeat(40),name:'Verify Edgeforce',status:'completed',conclusion:'success'}
  ];
  const backlog=evaluateReleaseBacklog({
    compare,
    runs,
    liveSha:'0'.repeat(40),
    headSha:'c'.repeat(40),
    now
  });
  assert.equal(backlog.headCertified,false);
  assert.equal(backlog.catchUpEligible,false);
  assert.match(backlog.reason,/has not completed the exact-main certification set/);
});

test('V143 fails closed when compare evidence is truncated',()=>{
  const backlog=evaluateReleaseBacklog({
    compare:{...compare,totalCommits:101},
    runs:[...successRuns('c'.repeat(40))],
    liveSha:'0'.repeat(40),
    headSha:'c'.repeat(40),
    now
  });
  assert.equal(backlog.truncated,true);
  assert.equal(backlog.catchUpEligible,false);
});

test('V143 Cloudflare verifier certifies push commits on main',()=>{
  assert.match(cloudflare,/push:\n    branches: \[main\]/);
});

test('V143 governor injects exact certification evidence before fair-share planning',()=>{
  assert.match(governor,/Capture Edgeforce certified release backlog/);
  assert.match(governor,/compare\/\$LIVE_SHA\.\.\.\$HEAD_SHA\?per_page=100/);
  assert.match(governor,/actions\/runs\?branch=main&per_page=100/);
  assert.match(governor,/headCertified/);
  assert.match(governor,/catchUpEligible/);
  assert.match(planner,/certificationReady/);
  assert.match(planner,/current main SHA has not completed exact-main certification/);
});

test('V143 backlog telemetry is durable and visible without a browser release action',()=>{
  assert.match(migration,/create table if not exists edgeforce_release_backlog_snapshots/);
  assert.match(migration,/newest_certified_sha text/);
  assert.match(telemetry,/getEdgeforceReleaseBacklog/);
  assert.match(telemetry,/persistEdgeforceReleaseBacklog/);
  assert.match(route,/backlogHistory/);
  assert.doesNotMatch(route,/export async function POST/);
  assert.match(panel,/Certified release backlog/);
  assert.match(panel,/Safe catch-up/);
});
