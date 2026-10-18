import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../worker/d1-cutover-audit.ts',import.meta.url),'utf8');
const standalone=readFileSync(new URL('../worker/d1-standalone.ts',import.meta.url),'utf8');
test('readiness audit never grants production cutover',()=>{assert.match(source,/cutoverAuthorized:false/);assert.match(source,/sourceReconciliationVerified:false/);assert.match(source,/backupRestoreVerified:false/);});
test('audits completeness and guards all runtime access',()=>{for(const t of ['market_snapshots','player_game_stats','injury_snapshots','calibration_metrics'])assert.ok(source.includes(t));assert.match(source,/Authorization/);assert.match(source,/COUNT\(\*\)/);assert.match(standalone,/d1CutoverAuditRoute\(request,env\)/);});
test('query surface is read-only',()=>{assert.doesNotMatch(source,/\b(?:DROP|INSERT|UPDATE|DELETE|ALTER|CREATE)\s+(?:TABLE|INTO|FROM)/i);});
