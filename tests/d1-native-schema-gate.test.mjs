import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const workflow=readFileSync(new URL('../.github/workflows/deploy-d1-native-dashboard.yml',import.meta.url),'utf8');
for(const [name,tables] of [
 ['Verify existing live D1 schema without writes',['intelligence_sources','specialist_tasks','sports_market_snapshots']],
 ['Confirm prediction watch tables and safety constraints',['prediction_arbitrage_alerts','prediction_arbitrage_observations','prediction_arbitrage_watches']],
]){
 test(`${name}: preserve CLI failures and reject missing schema or credentials`,()=>{
  const dir=mkdtempSync(join(tmpdir(),'d1-gate-'));
  try{
   const step=workflow.split(`      - name: ${name}\n`)[1].split('      - name: ')[0];
   const script=step.split('        run: |\n')[1].replace(/^          /gm,'').replaceAll('/tmp/',`${dir}/`);
   // Exercise the actual workflow shell with a fake CLI; no network or D1 writes.
   writeFileSync(join(dir,'npx'),'#!/bin/sh\nprintf "%s\\n" "$FAKE_D1_OUTPUT"\nexit "$FAKE_D1_STATUS"\n',{mode:0o755});
   const run=(output,status=0,token='test-token')=>spawnSync('bash',['-c',script],{encoding:'utf8',env:{...process.env,PATH:`${dir}:${process.env.PATH}`,CLOUDFLARE_API_TOKEN:token,FAKE_D1_OUTPUT:output,FAKE_D1_STATUS:String(status)}});
   const ok=run(JSON.stringify([{results:tables.map(name=>({name}))}]));
   assert.equal(ok.status,0,ok.stderr);
   const denied=run('{"error":"D1 permission denied"}',7);
   assert.equal(denied.status,7,denied.stderr);
   assert.match(denied.stdout,/D1 permission denied/);
   assert.notEqual(run('[{"results":[]}]').status,0);
   assert.notEqual(run('not JSON').status,0);
   const missing=run('CLI_MUST_NOT_RUN',0,'');
   assert.notEqual(missing.status,0);
   assert.match(missing.stdout,/CLOUDFLARE_D1_API_TOKEN is required/);
   assert.doesNotMatch(missing.stdout,/CLI_MUST_NOT_RUN/);
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
}
