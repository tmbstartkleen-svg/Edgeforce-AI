import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const stringList = value => Array.isArray(value) && value.every(x => typeof x === 'string');

// Never recover a JSON substring from noisy CLI output: malformed transport is a
// failed gate. The caller must capture stdout separately from stderr.
export function evaluateReleaseGate(kind, report, {remediation = false, legacyHandoff = false, strictCertified = false} = {}) {
  if (!object(report)) throw new Error(`${kind}: response must be a JSON object`);
  if (kind === 'canary') {
    if (report.schemaVersion !== 'v73-deployment-guard-1' ||
        typeof report.ok !== 'boolean' || typeof report.hardBlock !== 'boolean' ||
        !['PASS', 'BLOCK'].includes(report.decision) || !stringList(report.blockers)) {
      throw new Error('canary: invalid response contract');
    }
    if (report.hardBlock) throw new Error('canary: hard blocker');
    if (report.decision === 'PASS' && report.ok === true && report.blockers.length === 0) return 'PASS';
    return 'HOLD';
  }
  if (kind === 'slo') {
    if (report.schemaVersion !== 'v74-slo-governor-1' ||
        typeof report.deploymentAllowed !== 'boolean' || typeof report.ok !== 'boolean' ||
        !['OPEN', 'FROZEN', 'RECOVERING'].includes(report.state) ||
        !object(report.current) || typeof report.current.overall !== 'string' ||
        typeof report.current.actionIncidents !== 'number') {
      throw new Error('slo: invalid response contract');
    }
    if (report.ok && report.deploymentAllowed && report.state !== 'FROZEN') return 'SLO_BUDGET_PASSED';
    // Preserve the existing historical-freeze exception for a currently non-critical
    // remediation candidate with no ACTION incidents.
    if (remediation && report.deploymentAllowed === false &&
        ['HEALTHY', 'DEGRADED'].includes(report.current.overall) &&
        report.current.actionIncidents === 0) return 'SLO_REMEDIATION_ACCEPTED';
    // A pre-V74 production handoff has no comparable historical SLO model. The
    // candidate may inherit shared CRITICAL snapshots, so allow it to reach the
    // comparative canary only after this exact candidate already passed strict
    // certification. This is not available to normal remediation deployments.
    if (remediation && legacyHandoff && strictCertified &&
        report.state === 'FROZEN' && report.deploymentAllowed === false &&
        report.freezeTriggered === true && stringList(report.reasons) &&
        typeof report.current.criticalChecks === 'number' &&
        report.current.overall === 'CRITICAL') {
      return 'SLO_REMEDIATION_ACCEPTED';
    }
    throw new Error(`slo: deployment blocked (${report.state}; current ${String(report.current.overall)})`);
  }
  if (kind === 'v1') {
    if (report.ok !== true || !['GO', 'CONDITIONAL'].includes(report.verdict) ||
        !stringList(report.blockers) || report.blockers.length !== 0 ||
        report.strict !== true || !Array.isArray(report.gates) || report.gates.length === 0 ||
        report.gates.some(gate => !object(gate) || (gate.required && gate.state === 'FAIL'))) {
      throw new Error('v1: strict readiness did not pass');
    }
    return report.verdict;
  }
  throw new Error(`Unknown release gate: ${kind}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [kind, file] = process.argv.slice(2);
    if (!kind || !file) throw new Error('Usage: node scripts/release-gate.mjs <canary|slo|v1> <response.json>');
    const report = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log(evaluateReleaseGate(kind, report, {
      remediation: process.env.EDGEFORCE_REMEDIATION_DEPLOY === 'true',
      legacyHandoff: process.env.EDGEFORCE_LEGACY_REMEDIATION_HANDOFF === 'true',
      strictCertified: process.env.EDGEFORCE_STRICT_CERTIFIED === 'true'
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Release gate failed');
    process.exitCode = 1;
  }
}
