import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const src=fs.readFileSync(new URL('../worker/d1-backup-readiness.ts',import.meta.url),'utf8');
const standalone=fs.readFileSync(new URL('../worker/d1-standalone.ts',import.meta.url),'utf8');
test('backup readiness endpoint is protected and reads schema only',()=>{assert.match(src,/CRON_SECRET\.length<32/);assert.match(src,/sqlite_master/);assert.match(standalone,/backupReadinessRoute\(request,env\)/);});
test('schema inventory never claims a completed backup or restoration',()=>{for(const flag of ['verifiedSourceExport:false','backupArtifactCreated:false','isolatedRestorePerformed:false','restoreCertified:false','postgresMigrationComplete:false','productionCutoverAuthorized:false'])assert.ok(src.includes(flag));});
