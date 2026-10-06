import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateCertification, redactDiagnostic } from '../scripts/certification-evidence.mjs';

const commit = '9b33e540b1916f2e8979c2ce9490aec55c2c4f3e';
const expected = { version: '119.0.0', modelVersion: 'edgeforce-v119', migrationVersion: 114, commit };
const context = { httpStatus: '200', transportExit: '0', expected };
const report = () => ({ certified: true, blockers: [], warnings: [], release: { ...expected, build: 'V119', environment: 'production' },
  ingestion: { source: 'live', marketCount: 20, degraded: false }, reliability: { mode: 'NORMAL' },
  observability: { overall: 'HEALTHY' }, sloGovernor: { state: 'OPEN' }, incidents: { action: 0 } });
const evaluate = (value, changed = {}) => evaluateCertification(value, { ...context, ...changed }, {});

test('200, zero transport exit, literal certified and exact release identity pass', () => {
  assert.equal(evaluate(report()).accepted, true);
});
test('503 preserves the actual blocker diagnostics and rejects promotion', () => {
  const value = { ...report(), certified: false, blockers: ['automation: settle: No RESULTS providers configured'] };
  const result = evaluate(value, { httpStatus: '503', transportExit: '22' });
  assert.equal(result.accepted, false);
  assert.match(result.blockers[0], /No RESULTS providers configured/);
});
test('503 cannot pass even when a CLI exits zero or the body says certified', () => {
  assert.equal(evaluate(report(), { httpStatus: '503' }).accepted, false);
});
test('a nonzero transport exit invalidates a successful-looking HTTP 200 body', () => {
  assert.equal(evaluate(report(), { transportExit: '56' }).accepted, false);
});
test('missing, malformed, authentication and redirect status cannot pass', () => {
  for (const httpStatus of [undefined, '', '200\nnoise', '0200', '000', '301', '401', '403', '500']) {
    assert.equal(evaluate(report(), { httpStatus }).accepted, false);
  }
});
test('missing or string certification flags and malformed blockers fail closed', () => {
  for (const certified of [undefined, null, 'true', 1, false]) {
    assert.equal(evaluate({ ...report(), certified }).accepted, false);
  }
  for (const blockers of [undefined, null, '', {}, [null]]) {
    assert.equal(evaluate({ ...report(), blockers }).accepted, false);
  }
  assert.equal(evaluate({ ...report(), blockers: ['SLO: freeze active'] }).accepted, false);
});
test('every release identity field is enforced; credentials cannot select another release', () => {
  for (const [key, value] of Object.entries({ version: '118.0.0', modelVersion: 'edgeforce-v118', migrationVersion: 113,
    commit: 'f'.repeat(40), build: 'V118', environment: 'preview' })) {
    const valueReport = report(); valueReport.release[key] = value;
    assert.equal(evaluate(valueReport).accepted, false, key);
  }
  assert.equal(evaluate(report(), { expected: {} }).accepted, false);
});
test('known environment secrets, URLs, auth values and workflow-control characters are removed', () => {
  const value = redactDiagnostic('No RESULTS providers configured: secret-value https://u:p@host/path?token=x Bearer other-token\n::error::bad', { INGEST_SECRET: 'secret-value' });
  assert.equal(value.includes('secret-value'), false);
  assert.equal(value.includes('u:p@host'), false);
  assert.equal(value.includes('other-token'), false);
  assert.equal(value.includes('\n'), false);
});
test('only allowlisted fields are emitted and diagnostic output is bounded', () => {
  const value = report(); value.extra = 'SHOULD_NOT_APPEAR'; value.providerCertification = { key: 'NEVER_PRINT' };
  value.blockers = Array.from({ length: 101 }, () => 'x'.repeat(1000));
  const result = evaluate(value);
  const text = JSON.stringify(result);
  assert.equal(text.includes('SHOULD_NOT_APPEAR'), false);
  assert.equal(text.includes('NEVER_PRINT'), false);
  assert.equal(result.blockers.length, 100);
  assert.equal(result.blockers[0].length, 700);
  assert.equal(result.diagnosticsTruncated, true);
});

function workflowBody() {
  const workflow = fs.readFileSync('.github/workflows/deploy-production.yml', 'utf8');
  const step = workflow.split('      - name: Certify final production release\n')[1]?.split('\n      - name:')[0];
  assert.ok(step, 'certification step exists');
  return step.split('        run: |\n')[1].split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
}
function executeStep({ body = JSON.stringify(report()), status = '200', code = 0, extra = '' } = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'certification-evidence-test-'));
  try {
    const payload = path.join(temp, 'payload'); fs.writeFileSync(payload, body);
    const calls = path.join(temp, 'calls');
    const mock = `#!/usr/bin/env node\nconst fs=require('fs');\nconst a=process.argv.slice(2);\nfs.appendFileSync(process.env.MOCK_CALLS,'one-call\\n');\nconst i=a.indexOf('--output');\nif(i>=0)fs.writeFileSync(a[i+1],fs.readFileSync(process.env.MOCK_BODY));\nprocess.stderr.write('UNTRUSTED_TRANSPORT_SECRET');\nprocess.stdout.write(process.env.MOCK_STATUS);\nprocess.exit(Number(process.env.MOCK_EXIT));\n`;
    fs.writeFileSync(path.join(temp, 'vercel'), mock, { mode: 0o755 });
    const run = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', workflowBody() + '\necho PROMOTION_SENTINEL\n' + extra], {
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, PATH: temp + path.delimiter + process.env.PATH, TMPDIR: temp,
        MOCK_BODY: payload, MOCK_CALLS: calls, MOCK_STATUS: status, MOCK_EXIT: String(code),
        PRODUCTION_URL: 'https://example.vercel.app', INGEST_SECRET: 'fake-test-secret', DEPLOY_COMMIT: commit,
        EXPECTED_APP_VERSION: expected.version, EXPECTED_MODEL_VERSION: expected.modelVersion,
        EXPECTED_MIGRATION_VERSION: '114' }
    });
    assert.equal(run.error, undefined, run.error?.message);
    assert.equal(fs.readFileSync(calls, 'utf8'), 'one-call\n', 'POST must not be retried');
    assert.equal(run.stderr.includes('UNTRUSTED_TRANSPORT_SECRET'), false);
    assert.equal(fs.readdirSync(temp).some(name => fs.statSync(path.join(temp, name)).isDirectory()), false, 'private response directory is cleaned');
    return run;
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

test('actual Bash -e workflow prints 503 reasons before failing and prevents later steps', () => {
  const run = executeStep({ body: JSON.stringify({ ...report(), certified: false, blockers: ['automation: settle: No RESULTS providers configured'] }), status: '503', code: 22 });
  assert.notEqual(run.status, 0);
  assert.match(run.stdout, /No RESULTS providers configured/);
  assert.equal(run.stdout.includes('PROMOTION_SENTINEL'), false);
});
test('actual workflow passes a valid certification without leaking stderr', () => {
  const run = executeStep();
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /PROMOTION_SENTINEL/);
});
test('HTTP 200 certified false cannot advance', () => {
  const run = executeStep({ body: JSON.stringify({ ...report(), certified: false }) });
  assert.notEqual(run.status, 0);
  assert.equal(run.stdout.includes('PROMOTION_SENTINEL'), false);
});
test('invalid JSON and HTML failures are summarized without printing raw response', () => {
  for (const body of ['<html>PRIVATE_SECRET</html>', '{malformed PRIVATE_SECRET', '']) {
    const run = executeStep({ body, status: '503', code: 22 });
    assert.notEqual(run.status, 0);
    assert.equal(run.stdout.includes('PRIVATE_SECRET'), false);
    assert.match(run.stdout, /RESPONSE_MISSING_INVALID_OR_TOO_LARGE/);
  }
});
test('oversized response fails closed instead of being logged', () => {
  const run = executeStep({ body: 'x'.repeat(2 * 1024 * 1024 + 1) });
  assert.notEqual(run.status, 0);
  assert.match(run.stdout, /RESPONSE_MISSING_INVALID_OR_TOO_LARGE/);
});
test('transport reset is not retried and cannot advance', () => {
  const run = executeStep({ status: '000', code: 56 });
  assert.notEqual(run.status, 0);
  assert.match(run.stdout, /TRANSPORT_FAILED/);
  assert.equal(run.stdout.includes('PROMOTION_SENTINEL'), false);
});
test('shell step retains the original certification assertion, deadline and cleanup', () => {
  const body = workflowBody();
  assert.ok(body.includes("jq -e '.certified==true and (.blockers|length)==0'"));
  assert.match(body, /--max-time 120/);
  assert.match(body, /trap .* EXIT/);
  assert.equal(body.includes('--retry'), false);
  assert.equal(body.includes('|| true'), false);
});
