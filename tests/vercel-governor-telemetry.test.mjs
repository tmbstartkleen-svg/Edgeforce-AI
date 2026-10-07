import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const telemetry=readFileSync(new URL('../src/lib/vercelGovernorTelemetry.ts',import.meta.url),'utf8');
const route=readFileSync(new URL('../src/app/api/operations/vercel-governor/route.ts',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/components/VercelGovernorPanel.tsx',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/components/Dashboard.tsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../db/v115.sql',import.meta.url),'utf8');

test('V140 telemetry remains server-only and pages the rolling Vercel window',()=>{
  assert.match(telemetry,/import 'server-only'/);
  assert.match(telemetry,/process\.env\.VERCEL_TOKEN/);
  assert.match(telemetry,/since:String\(cutoff\)/);
  assert.match(telemetry,/params\.set\('until'/);
  assert.match(telemetry,/limit:'100'/);
  assert.match(telemetry,/seen=new Set/);
});

test('V140 recovery forecast accounts for every deployment above the normal budget',()=>{
  assert.match(telemetry,/slotsToRecover=usage>=softCap\?usage-softCap\+1:0/);
  assert.match(telemetry,/recent\[slotsToRecover-1\]/);
  assert.match(telemetry,/createdAt\(recoveryAnchor\)\+DAY/);
  assert.match(telemetry,/overHardCap=Math\.max\(0,usage-hardCap\)/);
  assert.match(telemetry,/reserveConsumed=Math\.min\(emergencyReserve,Math\.max\(0,usage-softCap\)\)/);
});

test('V140 classifies governed projects without exposing the credential to the browser',()=>{
  assert.match(telemetry,/governorState:'CURRENT'\|'ACTIVE'\|'APPROVED'\|'DEFERRED'/);
  assert.match(telemetry,/team normal deployment budget is exhausted/);
  assert.match(route,/x-edgeforce-governor-telemetry/);
  assert.doesNotMatch(panel,/VERCEL_TOKEN/);
  assert.match(panel,/CURRENT'\|'ACTIVE'\|'APPROVED'\|'DEFERRED/);
});

test('V140 persists throttled governor snapshots in migration v115',()=>{
  assert.match(migration,/create table if not exists vercel_governor_snapshots/);
  assert.match(migration,/next_normal_slot_at timestamptz/);
  assert.match(migration,/project_states jsonb/);
  assert.match(telemetry,/15\*60\*1000/);
  assert.match(telemetry,/insert into vercel_governor_snapshots/);
});

test('V140 governor telemetry is visible on the main dashboard',()=>{
  assert.match(dashboard,/import VercelGovernorPanel from '\.\/VercelGovernorPanel'/);
  assert.match(dashboard,/<VercelGovernorPanel\/>/);
  assert.match(panel,/SLOTS TO RECOVER/);
  assert.match(panel,/NEXT NORMAL SLOT/);
  assert.match(panel,/Governor history/);
});
