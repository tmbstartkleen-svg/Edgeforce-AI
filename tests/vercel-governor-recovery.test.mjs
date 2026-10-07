import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const telemetry=readFileSync(new URL('../src/lib/vercelGovernorTelemetry.ts',import.meta.url),'utf8');
const route=readFileSync(new URL('../src/app/api/operations/vercel-governor/route.ts',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/components/VercelGovernorPanel.tsx',import.meta.url),'utf8');
const manual=readFileSync(new URL('../.github/workflows/team-vercel-manual-release.yml',import.meta.url),'utf8');
const migration=readFileSync(new URL('../db/v116.sql',import.meta.url),'utf8');

test('V141 recovery timeline includes hard-cap and normal-capacity milestones',()=>{
  assert.match(telemetry,/buildRecoveryTimeline/);
  assert.match(telemetry,/HARD_CAP_CLEAR/);
  assert.match(telemetry,/NORMAL_CAPACITY/);
  assert.match(telemetry,/usage-hardCap/);
  assert.match(telemetry,/usage-softCap/);
  assert.match(telemetry,/recoveryTimeline/);
});

test('V141 governor decisions and alerts are durable and de-duplicated',()=>{
  assert.match(migration,/create table if not exists vercel_governor_decisions/);
  assert.match(migration,/create table if not exists vercel_governor_alerts/);
  assert.match(migration,/alert_key text not null unique/);
  assert.match(telemetry,/recordVercelGovernorDecisions/);
  assert.match(telemetry,/syncVercelGovernorAlerts/);
  assert.match(telemetry,/on conflict \(alert_key\) do update/);
  assert.match(telemetry,/resolved_at=coalesce\(resolved_at,now\(\)\)/);
});

test('V141 manual release fails closed at the hard cap and reserves emergency tier',()=>{
  assert.match(manual,/NORMAL_CAP: "84"/);
  assert.match(manual,/HARD_CAP: "90"/);
  assert.match(manual,/if \[ "\$COUNT" -ge "\$HARD_CAP" \]/);
  assert.match(manual,/if \[ "\$RELEASE_TIER" = "normal" \] && \[ "\$COUNT" -ge "\$NORMAL_CAP" \]/);
  assert.match(manual,/if \[ "\$RELEASE_TIER" = "emergency" \] && \[ "\$COUNT" -lt "\$NORMAL_CAP" \]/);
  assert.match(manual,/Hard-cap bypass: \*\*not permitted\*\*/);
});

test('V141 manual release uses exact paginated team usage and requires justification',()=>{
  assert.match(manual,/until=\$UNTIL/);
  assert.match(manual,/unique_by\(\.id\)/);
  assert.match(manual,/Manual release justification must be at least 12 characters/);
  assert.match(manual,/RELEASE_JUSTIFICATION: \$\{\{ inputs\.justification \}\}/);
  assert.match(manual,/--arg justification "\$RELEASE_JUSTIFICATION"/);
  assert.doesNotMatch(manual,/--arg justification '\$\{\{ inputs\.justification \}\}'/);
});

test('V141 preserves Edgeforce guarded deployment while peers use linked Git',()=>{
  assert.match(manual,/actions\/workflows\/deploy-production\.yml\/dispatches/);
  assert.match(manual,/gitSource:\{type:"github",repoId:\$repoId,ref:"main"\}/);
  assert.match(manual,/deploymentGovernor:"edgeforce-v141-manual"/);
  assert.doesNotMatch(manual,/--force/);
});

test('V141 public dashboard stays read-only and exposes reviewed manual control status',()=>{
  assert.match(route,/publicBrowserReadOnly:true/);
  assert.match(route,/hardBlocked:telemetry\.usage>=telemetry\.hardCap/);
  assert.match(route,/team-vercel-manual-release\.yml/);
  assert.doesNotMatch(route,/export async function POST/);
  assert.match(panel,/OPEN REVIEWED MANUAL RELEASE/);
  assert.match(panel,/Hard-cap bypass/);
  assert.match(panel,/Recovery timeline/);
  assert.match(panel,/Governor decision history/);
});
