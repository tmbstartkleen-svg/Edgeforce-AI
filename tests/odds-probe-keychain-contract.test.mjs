import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const path=new URL('../scripts/odds-probe-keychain.mjs',import.meta.url);
const source=readFileSync(path,'utf8');
test('no acknowledgement fails before Keychain lookup or provider requests',()=>{
 const r=spawnSync(process.execPath,[path.pathname],{encoding:'utf8',timeout:3000});
 assert.equal(r.status,2);
 assert.match(r.stderr,/--ack-provider-charge/);
});
test('Keychain wrapper passes key only in child environment, not process args',()=>{
 assert.match(source,/find-generic-password/);
 assert.match(source,/edgeforce-the-odds-api/);
 assert.match(source,/stdio:\['ignore','pipe','ignore'\]/);
 assert.match(source,/THE_ODDS_API_KEY:secret/);
 assert.match(source,/spawnSync\(process\.execPath,\[path,'--ack-provider-charge'\]/);
 assert.doesNotMatch(source,/writeFile|INSERT INTO|fetch\(|console\.log\(secret\)|console\.error\(secret\)/);
});
test('wrapper rejects unsupported platforms without running provider requests',()=>{
 if(process.platform==='darwin')return;
 const r=spawnSync(process.execPath,[path.pathname,'--ack-provider-charge'],{encoding:'utf8',timeout:3000});
 assert.equal(r.status,2);
 assert.match(r.stderr,/MACOS_KEYCHAIN_REQUIRED/);
});
