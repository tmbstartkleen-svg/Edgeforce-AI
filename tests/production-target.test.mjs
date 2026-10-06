import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {deploymentHost, validateProductionAlias, validateProductionDeployment, providerEnvironmentPresence} from '../scripts/production-target.mjs';

const projectId = 'prj_fixture';
const alias = 'edgeforce-ai.vercel.app';
const previous = 'dpl_previous';
const candidate = 'dpl_candidate';
const commit = 'a'.repeat(40);
const aliasReport = id => ({alias, projectId, deploymentId: id, deployment: {id}, redirect: null});
const deploymentReport = () => ({id: candidate, projectId, target: 'production', readyState: 'READY',
  url: 'edgeforce-candidate-fixture.vercel.app', meta: {edgeforceCommit: commit}});
const workflow = fs.readFileSync(new URL('../.github/workflows/deploy-production.yml', import.meta.url), 'utf8');
const step = name => {
  const marker = `      - name: ${name}\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `Missing step ${name}`);
  const end = workflow.indexOf('\n      - ', start + marker.length);
  return workflow.slice(start, end < 0 ? undefined : end);
};

test('actual production alias selects the rollback deployment, not the newest staged deployment', () => {
  assert.deepEqual(validateProductionAlias(aliasReport(previous), {projectId, alias}), {id: previous, alias});
  assert.throws(() => validateProductionAlias(aliasReport(previous), {projectId, alias, expectedId: candidate}));
  assert.deepEqual(validateProductionAlias(aliasReport(candidate), {projectId, alias, expectedId: candidate}), {id: candidate, alias});
});

test('alias rejects foreign project, hostname, missing deployment and inconsistent nested identity', () => {
  for (const change of [{projectId: 'prj_other'}, {alias: 'other.vercel.app'}, {deploymentId: null},
    {deploymentId: 'not-a-deployment'}, {deployment: {id: candidate}}, {redirect: 'other.example'}, {deletedAt: 1}]) {
    assert.throws(() => validateProductionAlias({...aliasReport(previous), ...change}, {projectId, alias}));
  }
  for (const invalid of [null, [], {}, 'ok']) assert.throws(() => validateProductionAlias(invalid, {projectId, alias}));
  assert.throws(() => validateProductionAlias(aliasReport(previous)));
});

test('staging guard rejects a candidate that has already taken production traffic', () => {
  assert.throws(() => validateProductionAlias(aliasReport(candidate), {projectId, alias, expectedId: previous}));
});

test('candidate proof binds project, production target, READY state, URL and exact source commit', () => {
  const options = {projectId, expectedId: candidate, expectedUrl: 'https://edgeforce-candidate-fixture.vercel.app', commit};
  assert.deepEqual(validateProductionDeployment(deploymentReport(), options), {
    id: candidate, target: 'production', url: options.expectedUrl
  });
  for (const change of [{projectId: 'prj_other'}, {id: previous}, {target: 'preview'}, {target: null},
    {readyState: 'BUILDING'}, {readyState: 'ERROR'}, {url: 'other.vercel.app'}, {meta: {}},
    {meta: {edgeforceCommit: 'b'.repeat(40)}}]) {
    assert.throws(() => validateProductionDeployment({...deploymentReport(), ...change}, options));
  }
  assert.throws(() => validateProductionDeployment(deploymentReport(), {...options, commit: 'main'}));
});

test('prior production metadata does not need new candidate metadata but must be READY production', () => {
  const prior = {...deploymentReport(), id: previous, meta: {}};
  assert.equal(validateProductionDeployment(prior, {projectId, expectedId: previous}).id, previous);
  assert.throws(() => validateProductionDeployment({...prior, target: 'preview'}, {projectId, expectedId: previous}));
});

test('deployment host refuses credentials, cross-host URLs, paths, queries and shell-control content', () => {
  assert.equal(deploymentHost('https://edgeforce-test.vercel.app'), 'edgeforce-test.vercel.app');
  assert.equal(deploymentHost('edgeforce-test.vercel.app'), 'edgeforce-test.vercel.app');
  for (const bad of ['', null, 'http://edgeforce-test.vercel.app', 'https://u:p@edgeforce-test.vercel.app',
    'https://edgeforce-test.vercel.app.evil.example', 'https://evil.example', 'edgeforce-test.vercel.app/',
    'edgeforce-test.vercel.app?token=secret', 'edgeforce-test.vercel.app\nINJECTED=value',
    '-test.vercel.app', 'test-.vercel.app', ' nested.vercel.app', 'test.vercel.app#frag']) {
    assert.throws(() => deploymentHost(bad));
  }
});

test('presence report distinguishes production-only configuration without certifying provider health', () => {
  const report = providerEnvironmentPresence({envs: [
    {key: 'THE_ODDS_API_KEY', target: ['production', 'preview'], value: 'secret-key'},
    {key: 'RESULTS_PROVIDER_PRIMARY_URL', target: ['production'], value: 'https://private.example?key=secret'},
    {key: 'SPORTS_GAME_ODDS_API_KEY', target: ['preview'], gitBranch: 'test-only', value: 'branch-secret'}
  ]});
  assert.deepEqual(report.productionOnlyKeys, ['RESULTS_PROVIDER_PRIMARY_URL']);
  assert.equal(report.resultsUrlPresent, true);
  assert.equal(report.configurationOnly, true);
  assert.equal(report.valuesRedacted, true);
  assert.equal(report.variables.find(row => row.key === 'SPORTS_GAME_ODDS_API_KEY').preview, false);
  assert.match(report.note, /not proof.*quota/);
});

test('presence summary never returns values, custom keys, IDs or URLs', () => {
  const marker = 'DO_NOT_LEAK_123';
  const output = JSON.stringify(providerEnvironmentPresence({envs: [
    {key: 'THE_ODDS_API_KEY', target: ['production'], value: marker, id: marker, comment: marker},
    {key: marker, target: ['production'], value: marker}
  ], extra: marker}));
  assert.equal(output.includes(marker), false);
  assert.equal(output.includes('"value"'), false);
  assert.equal(output.includes('"id"'), false);
});

test('malformed provider metadata cannot become valid presence evidence', () => {
  for (const report of [null, [], {}, {envs: [null]}, {envs: [{key: 'THE_ODDS_API_KEY', target: 'production'}]},
    {envs: [{key: 'THE_ODDS_API_KEY', target: [null]}]}]) assert.throws(() => providerEnvironmentPresence(report));
  assert.equal(providerEnvironmentPresence({envs: []}).resultsUrlPresent, false);
});

test('CLI sanitizes malformed API input and returns failure without reflecting secret diagnostics', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeforce-target-'));
  try {
    const file = path.join(folder, 'metadata.json');
    fs.writeFileSync(file, '{"SECRET_VALUE_NEVER_LOG":');
    const result = spawnSync(process.execPath, ['scripts/production-target.mjs', 'environment', file], {encoding: 'utf8'});
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr.includes('SECRET_VALUE_NEVER_LOG'), false);
    assert.match(result.stderr, /validation failed/);
  } finally { fs.rmSync(folder, {recursive: true, force: true}); }
});

test('workflow stages a production-built artifact with automatic domain assignment disabled', () => {
  assert.match(step('Build staged production artifact'), /build --prod/);
  const deploy = step('Deploy prebuilt remediation candidate');
  assert.match(deploy, /--prebuilt\s+--prod\s+--skip-domain/);
  assert.match(deploy, /--meta edgeforceCommit="\$DEPLOY_COMMIT"/);
  assert.doesNotMatch(deploy, /(?:^|\n)\s*vercel[^\n]*\s(?:promote|alias set)\b|--force/);
  assert.match(workflow, /concurrency:\n  group: edgeforce-vercel-production\n  cancel-in-progress: false/);
});

test('baseline, staging and prepromotion checks all read actual project-scoped alias identity', () => {
  for (const name of ['Capture previous production deployment', 'Verify candidate target and unchanged production alias',
    'Recheck production alias before promotion']) {
    assert.match(step(name), /\/v4\/aliases\/\$PRODUCTION_ALIAS\?projectId=\$VERCEL_PROJECT_ID&teamId=\$VERCEL_ORG_ID/);
    assert.match(step(name), /scripts\/production-target\.mjs alias/);
  }
  assert.doesNotMatch(workflow, /target=production&state=READY&limit=1/);
  assert.match(step('Verify candidate target and unchanged production alias'), /EXPECTED_DEPLOYMENT_COMMIT="\$DEPLOY_COMMIT"/);
  assert.match(step('Recheck production alias before promotion'), /EXPECTED_DEPLOYMENT_ID="\$PREVIOUS_DEPLOYMENT_ID"/);
});

test('existing SLO, canary and strict readiness gates precede promotion without bypass', () => {
  const promoteIndex = workflow.indexOf('      - name: Promote certified candidate to production');
  for (const name of ['Require strict launch doctor', 'Smoke test production deployment', 'Certify final production release',
    'Refresh candidate SLO governor', 'Run comparative canary guard', 'Require strict V1 readiness', 'Recheck production alias before promotion']) {
    assert.ok(workflow.indexOf(`      - name: ${name}\n`) < promoteIndex);
    assert.doesNotMatch(step(name), /continue-on-error|\|\| true/);
  }
  assert.match(step('Refresh candidate SLO governor'), /node scripts\/release-gate\.mjs slo/);
  assert.match(step('Run comparative canary guard'), /test "\$PASSES" -ge 2/);
  assert.match(step('Require strict V1 readiness'), /node scripts\/release-gate\.mjs v1/);
  assert.match(step('Roll back production on hosted failure'), /steps\.promote\.outcome == 'success'/);
});

test('postpromotion proof checks actual alias plus exact live runtime commit before recording evidence', () => {
  for (const name of ['Verify production alias points to certified candidate', 'Verify live deployment identity after promotion']) {
    const content = step(name);
    assert.match(content, /EXPECTED_DEPLOYMENT_ID="\$CANDIDATE_DEPLOYMENT_ID"/);
    assert.match(content, /--deployment "https:\/\/\$PRODUCTION_ALIAS"/);
    assert.match(content, /\.deploymentCommit==\$commit/);
    assert.match(content, /\.releaseIdentityMatch==true/);
  }
});

test('provider inventory is metadata-only and removes raw response file', () => {
  const content = step('Report production provider configuration presence');
  assert.match(content, /decrypt=false/);
  assert.match(content, /umask 077/);
  assert.match(content, /trap 'rm -f \/tmp\/edgeforce-env-metadata\.json' EXIT/);
  assert.match(content, /node scripts\/production-target\.mjs environment/);
  assert.doesNotMatch(content, /cat \/tmp|decrypt=true|--method POST/);
});
