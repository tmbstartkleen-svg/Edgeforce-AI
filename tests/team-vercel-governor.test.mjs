import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {evaluateTeamGovernor} from '../scripts/team-vercel-governor.mjs';

const config=JSON.parse(readFileSync(new URL('../config/vercel-team-governor.json',import.meta.url),'utf8'));
const workflow=readFileSync(new URL('../.github/workflows/team-vercel-governor.yml',import.meta.url),'utf8');
const now=1_800_000_000_000;

const status=(overrides={})=>[
  {key:'edgeforce',headSha:'b'.repeat(40),liveSha:'a'.repeat(40),lastDeploymentAt:now-8_000_000,active:false,...(overrides.edgeforce||{})},
  {key:'safeguard',repoUpdatedAt:now-1_000,lastDeploymentAt:now-9_000_000,active:false,...(overrides.safeguard||{})},
  {key:'travai',repoUpdatedAt:now-2_000,lastDeploymentAt:now-7_000_000,active:false,...(overrides.travai||{})}
];

const deployments=count=>Array.from({length:count},(_,i)=>({created:now-60_000-i}));

test('V139 partitions normal capacity from six emergency reserve slots',()=>{
  assert.equal(config.softCap,84);
  assert.equal(config.hardCap,90);
  assert.equal(config.emergencyReserve,6);
  const plan=evaluateTeamGovernor({config,deployments:deployments(84),statuses:status(),now});
  assert.equal(plan.usage,84);
  assert.equal(plan.saturated,true);
  assert.equal(plan.decisions.filter(x=>x.state==='APPROVED').length,0);
});

test('V139 coalesces stale projects and approves oldest pending releases first',()=>{
  const plan=evaluateTeamGovernor({config,deployments:deployments(40),statuses:status(),now});
  const approved=plan.decisions.filter(x=>x.state==='APPROVED');
  assert.equal(approved.length,3);
  assert.deepEqual(
    approved.slice().sort((a,b)=>a.lastDeploymentAt-b.lastDeploymentAt).map(x=>x.key),
    ['safeguard','edgeforce','travai']
  );
});

test('V139 suppresses active and cooldown releases',()=>{
  const plan=evaluateTeamGovernor({
    config,
    deployments:deployments(20),
    statuses:status({
      edgeforce:{active:true},
      safeguard:{lastDeploymentAt:now-60_000},
      travai:{repoUpdatedAt:now-10_000_000}
    }),
    now
  });
  assert.equal(plan.decisions.find(x=>x.key==='edgeforce').state,'DEFERRED');
  assert.equal(plan.decisions.find(x=>x.key==='safeguard').state,'DEFERRED');
  assert.equal(plan.decisions.find(x=>x.key==='travai').state,'CURRENT');
});

test('V139 central workflow preserves Edgeforce gated release and uses linked Git for peer projects',()=>{
  assert.match(workflow,/cron: '17 \* \* \* \*'/);
  assert.match(workflow,/deploy-production\.yml\/dispatches/);
  assert.match(workflow,/v13\/deployments\?teamId=\$TEAM_ID&forceNew=0/);
  assert.match(workflow,/deploymentGovernor:"edgeforce-v139"/);
  assert.match(workflow,/v1\/integrations\/search-repo\?provider=github/);
  assert.doesNotMatch(workflow,/--force/);
});


const namedDeployments=(counts)=>{
  const rows=[];
  for(const [name,count] of Object.entries(counts)){
    for(let i=0;i<count;i++)rows.push({name,created:now-60_000-rows.length});
  }
  return rows;
};

test('V142 project shares exactly partition the 84-slot normal budget',()=>{
  assert.equal(config.schemaVersion,'v142-team-vercel-governor-2');
  assert.equal(config.projects.reduce((sum,p)=>sum+p.normalBudgetShare,0),config.softCap);
  assert.deepEqual(
    Object.fromEntries(config.projects.map(p=>[p.key,p.normalBudgetShare])),
    {edgeforce:34,safeguard:28,travai:22}
  );
});

test('V142 under-share pending work outranks a high-volume over-share project',()=>{
  const plan=evaluateTeamGovernor({
    config,
    deployments:namedDeployments({'edgeforce-ai':20,safeguard:40,travai:20}),
    statuses:status(),
    now
  });
  const edge=plan.decisions.find(x=>x.key==='edgeforce');
  const safe=plan.decisions.find(x=>x.key==='safeguard');
  assert.equal(edge.budgetState,'UNDER_SHARE');
  assert.equal(safe.budgetState,'OVER_SHARE');
  assert.ok(edge.queueRank<safe.queueRank);
  assert.ok(edge.fairnessScore>safe.fairnessScore);
});

test('V142 aging raises fairness without overriding the shared hard capacity gate',()=>{
  const aged=status({
    edgeforce:{lastDeploymentAt:now-23*3_600_000},
    safeguard:{lastDeploymentAt:now-2*3_600_000},
    travai:{lastDeploymentAt:now-2*3_600_000}
  });
  const plan=evaluateTeamGovernor({
    config,
    deployments:namedDeployments({'edgeforce-ai':30,safeguard:27,travai:26}),
    statuses:aged,
    now
  });
  const edge=plan.decisions.find(x=>x.key==='edgeforce');
  assert.ok(edge.agingScore>200);
  assert.equal(plan.usage,83);
  assert.equal(plan.decisions.filter(x=>x.state==='APPROVED').length,1);
});

test('V142 permits at most one over-share borrower after under-share demand is satisfied',()=>{
  const local=structuredClone(config);
  local.maxActionsPerRun=3;
  const plan=evaluateTeamGovernor({
    config:local,
    deployments:namedDeployments({'edgeforce-ai':34,safeguard:28,travai:20}),
    statuses:status({
      edgeforce:{lastDeploymentAt:now-9_000_000},
      safeguard:{lastDeploymentAt:now-10_000_000},
      travai:{lastDeploymentAt:now-11_000_000}
    }),
    now
  });
  const approved=plan.decisions.filter(x=>x.state==='APPROVED');
  const borrowed=approved.filter(x=>x.borrowedCapacity);
  assert.equal(approved.some(x=>x.key==='travai'),true);
  assert.ok(borrowed.length<=config.fairness.maxBorrowedActionsPerRun);
});

test('V142 queue exposes rank, fairness score, share usage, and budget state',()=>{
  const plan=evaluateTeamGovernor({
    config,
    deployments:namedDeployments({'edgeforce-ai':10,safeguard:10,travai:10}),
    statuses:status(),
    now
  });
  assert.ok(plan.queue.length===3);
  assert.ok(plan.queue.every(row=>Number.isInteger(row.queueRank)&&Number.isFinite(row.fairnessScore)));
  assert.ok(plan.queue.every(row=>row.normalBudgetShare>0&&row.projectUsage24h===10));
});
