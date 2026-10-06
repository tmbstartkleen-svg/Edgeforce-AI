import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string');
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const enumValue = (value, allowed) => allowed.includes(value) ? value : 'UNKNOWN';

/** Only known diagnostic fields are emitted, never the complete HTTP response. */
export function redactDiagnostic(value, env = process.env) {
  let text = String(value);
  const secrets = Object.entries(env)
    .filter(([key, item]) => /(?:SECRET|TOKEN|PASSWORD|KEY|URL|URI)/i.test(key) && typeof item === 'string' && item.length >= 4)
    .map(([, item]) => item).sort((a, b) => b.length - a.length);
  for (const secret of secrets) text = text.split(secret).join('[REDACTED]');
  return text
    .replace(/\b(?:https?|postgres(?:ql)?|redis(?:s)?):\/\/[^\s"'<>]+/gi, '[URL REDACTED]')
    .replace(/\b(?:bearer|basic)\s+[^\s,;"']+/gi, '[AUTH REDACTED]')
    .replace(/\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;"']+/gi, '[CREDENTIAL REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[TOKEN REDACTED]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .slice(0, 700);
}

/** A diagnostic HTTP 503 is evidence of failure, never permission to promote. */
export function evaluateCertification(report, context, env = process.env) {
  const expected = context.expected || {};
  const validExpected = /^\d+\.\d+\.\d+$/.test(expected.version || '') &&
    /^edgeforce-v\d+$/.test(expected.modelVersion || '') &&
    Number.isSafeInteger(expected.migrationVersion) && expected.migrationVersion > 0 &&
    /^[a-f0-9]{40}$/.test(expected.commit || '');
  const transportValid = /^\d{1,3}$/.test(String(context.transportExit));
  const httpValid = /^[1-5]\d{2}$/.test(String(context.httpStatus));
  const shapeValid = object(report) && typeof report.certified === 'boolean' &&
    strings(report.blockers) && strings(report.warnings) && object(report.release);
  const release = shapeValid ? report.release : {};
  const identityMatch = Boolean(validExpected && shapeValid &&
    release.version === expected.version && release.modelVersion === expected.modelVersion &&
    release.migrationVersion === expected.migrationVersion && release.commit === expected.commit &&
    release.build === `V${expected.version.split('.')[0]}` && release.environment === 'production');
  const failures = [];
  if (!validExpected) failures.push('EXPECTED_IDENTITY_INVALID');
  if (!transportValid || String(context.transportExit) !== '0') failures.push('TRANSPORT_FAILED');
  if (!httpValid || String(context.httpStatus) !== '200') failures.push('HTTP_NOT_200');
  if (!shapeValid) failures.push('CERTIFICATION_SCHEMA_INVALID');
  if (!identityMatch) failures.push('RELEASE_IDENTITY_MISMATCH');
  if (shapeValid && report.certified !== true) failures.push('CERTIFICATION_REJECTED');
  if (shapeValid && report.blockers.length > 0) failures.push('CERTIFICATION_BLOCKERS_PRESENT');
  const ingestion = object(report?.ingestion) ? report.ingestion : {};
  const reliability = object(report?.reliability) ? report.reliability : {};
  const observability = object(report?.observability) ? report.observability : {};
  const slo = object(report?.sloGovernor) ? report.sloGovernor : {};
  const incidents = object(report?.incidents) ? report.incidents : {};
  return {
    kind: 'production-certification-evidence',
    schemaVersion: 1,
    accepted: failures.length === 0,
    httpStatus: httpValid ? Number(context.httpStatus) : null,
    transportExit: transportValid ? Number(context.transportExit) : null,
    releaseIdentityMatch: identityMatch,
    failureCodes: failures,
    certified: shapeValid ? report.certified : null,
    blockerCount: shapeValid ? report.blockers.length : null,
    blockers: shapeValid ? report.blockers.slice(0, 100).map(item => redactDiagnostic(item, env)) : [],
    warnings: shapeValid ? report.warnings.slice(0, 30).map(item => redactDiagnostic(item, env)) : [],
    diagnosticsTruncated: Boolean(shapeValid && (report.blockers.length > 100 || report.warnings.length > 30)),
    ingestion: {
      source: enumValue(ingestion.source, ['live', 'stored', 'pulse', 'unavailable', 'demo']),
      marketCount: count(ingestion.marketCount),
      degraded: typeof ingestion.degraded === 'boolean' ? ingestion.degraded : null
    },
    reliabilityMode: enumValue(reliability.mode, ['HEALTHY', 'NORMAL', 'DEGRADED', 'PROTECTIVE']),
    observabilityOverall: enumValue(observability.overall, ['HEALTHY', 'DEGRADED', 'CRITICAL']),
    sloState: enumValue(slo.state, ['HEALTHY', 'OPEN', 'NORMAL', 'FROZEN', 'RECOVERING']),
    actionIncidents: count(incidents.action)
  };
}

export function main(argv = process.argv.slice(2), env = process.env) {
  let report = null;
  let responseIssue = null;
  try {
    if (argv.length !== 1) throw new Error('input');
    const info = fs.lstatSync(argv[0]);
    if (!info.isFile() || info.size === 0 || info.size > MAX_RESPONSE_BYTES) throw new Error('size');
    report = JSON.parse(fs.readFileSync(argv[0], 'utf8'));
  } catch {
    // Do not echo parser errors, filenames, stderr, HTML or arbitrary response data.
    responseIssue = 'RESPONSE_MISSING_INVALID_OR_TOO_LARGE';
  }
  const result = evaluateCertification(report, {
    httpStatus: env.CERTIFICATION_HTTP_STATUS,
    transportExit: env.CERTIFICATION_TRANSPORT_EXIT,
    expected: {
      version: env.EXPECTED_APP_VERSION,
      modelVersion: env.EXPECTED_MODEL_VERSION,
      migrationVersion: Number(env.EXPECTED_MIGRATION_VERSION),
      commit: env.DEPLOY_COMMIT
    }
  }, env);
  if (responseIssue) {
    result.accepted = false;
    result.failureCodes.push(responseIssue);
  }
  console.log(JSON.stringify(result, null, 2));
  return result.accepted ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
