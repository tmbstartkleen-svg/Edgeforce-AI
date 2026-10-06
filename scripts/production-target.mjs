import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(message); };
const deploymentId = value => typeof value === 'string' && /^dpl_[A-Za-z0-9]+$/.test(value);

export function deploymentHost(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) fail('Invalid deployment hostname');
  const host = value.startsWith('https://') ? value.slice(8) : value;
  if (!/^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/.test(host)) fail('Invalid deployment hostname');
  return host;
}

export function validateProductionAlias(report, {projectId, alias, expectedId} = {}) {
  if (!projectId || !alias || !object(report) || report.projectId !== projectId || report.alias !== alias ||
      report.redirect || report.deletedAt || !deploymentId(report.deploymentId)) fail('Production alias identity mismatch');
  if (report.deployment !== undefined && (!object(report.deployment) || report.deployment.id !== report.deploymentId)) {
    fail('Production alias deployment identity mismatch');
  }
  if (expectedId && report.deploymentId !== expectedId) fail('Production alias does not point to the expected deployment');
  return {id: report.deploymentId, alias};
}

export function validateProductionDeployment(report, {projectId, expectedId, expectedUrl, commit} = {}) {
  if (!projectId || !object(report) || report.projectId !== projectId || !deploymentId(report.id) ||
      report.target !== 'production' || report.readyState !== 'READY') fail('Expected a ready production-target deployment');
  if (expectedId && report.id !== expectedId) fail('Deployment ID mismatch');
  const host = deploymentHost(report.url);
  if (expectedUrl && host !== deploymentHost(expectedUrl)) fail('Deployment URL mismatch');
  if (commit && (!/^[a-f0-9]{40}$/.test(commit) || report.meta?.edgeforceCommit !== commit)) fail('Deployment commit mismatch');
  return {id: report.id, url: `https://${host}`, target: 'production'};
}

// Emit presence only. Never include the API response values, IDs or URLs in
// logs: even decrypt=false responses can contain plain or encrypted secrets.
export function providerEnvironmentPresence(report) {
  if (!object(report) || !Array.isArray(report.envs)) fail('Invalid environment metadata response');
  const keys = ['THE_ODDS_API_KEY', 'SPORTS_GAME_ODDS_API_KEY',
    'ODDS_PROVIDER_PRIMARY_URL', 'ODDS_PROVIDER_SECONDARY_URL', 'ODDS_PROVIDER_TERTIARY_URL',
    'RESULTS_PROVIDER_PRIMARY_URL', 'RESULTS_PROVIDER_PRIMARY_KEY'];
  const rows = report.envs;
  if (rows.some(row => !object(row) || typeof row.key !== 'string' || !Array.isArray(row.target) || row.target.some(target => typeof target !== 'string'))) {
    fail('Invalid environment metadata row');
  }
  const present = (key, target) => rows.some(row => row.key === key && row.target.includes(target) && !row.gitBranch);
  const variables = keys.map(key => ({key, production: present(key, 'production'), preview: present(key, 'preview')}));
  return {kind: 'provider-environment-presence', valuesRedacted: true, configurationOnly: true, variables,
    productionOnlyKeys: variables.filter(row => row.production && !row.preview).map(row => row.key),
    resultsUrlPresent: present('RESULTS_PROVIDER_PRIMARY_URL', 'production'),
    note: 'Presence is not proof of valid credentials, quota, compatible results, freshness or usable odds.'};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [mode, file] = process.argv.slice(2);
    const report = JSON.parse(fs.readFileSync(file, 'utf8'));
    const options = {projectId: process.env.VERCEL_PROJECT_ID, alias: process.env.PRODUCTION_ALIAS,
      expectedId: process.env.EXPECTED_DEPLOYMENT_ID, expectedUrl: process.env.EXPECTED_DEPLOYMENT_URL,
      commit: process.env.EXPECTED_DEPLOYMENT_COMMIT};
    const result = mode === 'alias' ? validateProductionAlias(report, options) :
      mode === 'deployment' ? validateProductionDeployment(report, options) :
      mode === 'environment' ? providerEnvironmentPresence(report) : fail('Unknown production-target validation mode');
    console.log(JSON.stringify(result));
  } catch {
    // Do not reflect raw API responses or filesystem/parser diagnostics.
    console.error('Production-target validation failed; no promotion evidence accepted.');
    process.exitCode = 1;
  }
}
