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
