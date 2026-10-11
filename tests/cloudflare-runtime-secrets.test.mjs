import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,statSync,symlinkSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {runtimeSecrets,writeRuntimeSecrets} from '../scripts/cloudflare-runtime-secrets.mjs';
const env={DATABASE_URL:'postgres://fixture-only',INGEST_SECRET:'fixture-ingest',CRON_SECRET:'fixture-cron'};

test('atomic payload includes only required secrets and an explicitly configured optional key',()=>{
 assert.deepEqual(runtimeSecrets({...env,VERCEL_TOKEN:'must-not-export',UNKNOWN_KEY:'must-not-export'}),env);
 assert.deepEqual(runtimeSecrets({...env,THE_ODDS_API_KEY:'fixture-odds',SPORTS_GAME_ODDS_API_KEY:'fixture-sgo',FOOTBALL_DATA_API_KEY:'fixture-football',API_SPORTS_KEY:'fixture-api-sports',BIGBALLS_API_KEY:'fixture-bigballs'}),{...env,THE_ODDS_API_KEY:'fixture-odds',SPORTS_GAME_ODDS_API_KEY:'fixture-sgo',FOOTBALL_DATA_API_KEY:'fixture-football',API_SPORTS_KEY:'fixture-api-sports',BIGBALLS_API_KEY:'fixture-bigballs'});
 assert.deepEqual(runtimeSecrets({...env,SPORTS_GAME_ODDS_API_KEY:''}),env);
});

test('SharpAPI deploy opt-in requires BOTH a genuine configured key and explicit switch',()=>{
 assert.deepEqual(runtimeSecrets({...env,SHARP_API_KEY:'real-looking-test-key'}),env);
 assert.deepEqual(runtimeSecrets({...env,SHARP_API_ENABLED:'false',SHARP_API_KEY:'real-looking-test-key'}),env);
 assert.deepEqual(runtimeSecrets({...env,SHARP_API_ENABLED:'true',SHARP_API_KEY:'fixture-sharp'}),{
  ...env,SHARP_API_KEY:'fixture-sharp',SHARP_API_ENABLED:'true'
 });
 for(const key of [undefined,'',' ','[SENSITIVE]','bad\\nkey']){
  assert.throws(()=>runtimeSecrets({...env,SHARP_API_ENABLED:'true',SHARP_API_KEY:key}),/SharpAPI/);
 }
 assert.throws(()=>runtimeSecrets({...env,SHARP_API_ENABLED:'yes',SHARP_API_KEY:'fixture'}),/SharpAPI/);
 const workflow=readFileSync(new URL('../.github/workflows/deploy-cloudflare.yml',import.meta.url),'utf8');
 assert.match(workflow,/SHARP_API_KEY:.*secrets.SHARP_API_KEY/);
 assert.match(workflow,/SHARP_API_ENABLED:.*vars.SHARP_API_ENABLED/);
});
test('missing, placeholder and control-character values fail without reflecting credentials',()=>{
 for(const key of Object.keys(env)){
  for(const value of [undefined,'',' ','[SENSITIVE]','private\nsecret','private\0secret']){
   assert.throws(()=>runtimeSecrets({...env,[key]:value}),error=>
    error.message==='Required Cloudflare runtime secret is missing or invalid');
  }
 }
 for(const key of ['THE_ODDS_API_KEY','SPORTS_GAME_ODDS_API_KEY','FOOTBALL_DATA_API_KEY','API_SPORTS_KEY','BIGBALLS_API_KEY']){
  assert.throws(()=>runtimeSecrets({...env,[key]:'[SENSITIVE]'}),/Optional/);
 }
 assert.doesNotThrow(()=>runtimeSecrets(env));
});

test('JSON serialization preserves secret punctuation and private file permissions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'edgeforce-secrets-test-'));
 try{
  const file=join(dir,'secrets.json');const values={...env,INGEST_SECRET:'quote"backslash\\dollar$space value'};
  assert.deepEqual(writeRuntimeSecrets(file,values),{prepared:true});
  assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),values);
  assert.equal(statSync(file).mode&0o777,0o600);
  assert.throws(()=>writeRuntimeSecrets(file,env),/Could not create/);
  assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),values);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('pre-existing symlink cannot redirect secret writes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'edgeforce-secrets-test-'));
 try{
  const target=join(dir,'target');writeFileSync(target,'unchanged');
  const file=join(dir,'secrets.json');symlinkSync(target,file);
  assert.throws(()=>writeRuntimeSecrets(file,env),/Could not create/);
  assert.equal(readFileSync(target,'utf8'),'unchanged');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('CLI emits no secret values on success or failure',()=>{
 const dir=mkdtempSync(join(tmpdir(),'edgeforce-secrets-test-'));
 try{
  const script=new URL('../scripts/cloudflare-runtime-secrets.mjs',import.meta.url);
  const file=join(dir,'secrets.json');
  const success=spawnSync(process.execPath,[script.pathname,file],{encoding:'utf8',env:{...process.env,...env}});
  assert.equal(success.status,0);
  const failure=spawnSync(process.execPath,[script.pathname,file],{encoding:'utf8',env:{...process.env,...env}});
  assert.equal(failure.status,1);
  for(const value of Object.values(env))assert.ok(!`${success.stdout}${success.stderr}${failure.stdout}${failure.stderr}`.includes(value));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('workflow deploys code and secrets once, cleans private files, and retains hosted gates',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/deploy-cloudflare.yml',import.meta.url),'utf8');
 assert.match(workflow,/group: edgeforce-cloudflare-production/);
 assert.match(workflow,/cancel-in-progress: false/);
 assert.match(workflow,/git rev-parse FETCH_HEAD/);
 assert.match(workflow,/deploy --config dist\/server\/wrangler\.json --secrets-file/);
 assert.doesNotMatch(workflow,/\n\s+secrets:\s*\|/);
 assert.doesNotMatch(workflow,/wrangler secret (put|bulk)/);
 assert.match(workflow,/if: always\(\) && env\.EDGEFORCE_RUNTIME_SECRET_DIR/);
 assert.match(workflow,/rm -f "\$EDGEFORCE_RUNTIME_SECRET_DIR\/secrets\.json"/);
 for(const gate of ['Require both exact-main certification workflows','Wait for exact Worker release identity','Certify recommendation data without blocking platform launch','Observe live sportsbook continuity without blocking platform launch','Strict Cloudflare platform launch doctor','Hosted V119 smoke test'])assert.ok(workflow.includes(gate));
 assert.doesNotMatch(workflow,/missing\+=\("THE_ODDS_API_KEY"\)/);
 assert.match(workflow,/launch-doctor\?strict=1&platform=1/);
 assert.ok(workflow.indexOf('Generate Edgeforce runtime secrets')<workflow.indexOf('Build Cloudflare Worker'));
 assert.ok(workflow.indexOf('Prepare atomic Cloudflare')<workflow.indexOf('id: deploy'));
 assert.match(workflow,/for ATTEMPT in \{1\.\.10\}/);
 assert.match(workflow,/\[ \"\$HTTP_CODE\" = \"401\" \]/);
 assert.match(workflow,/Waiting for rotated Cloudflare ingest secret propagation/);
 assert.ok(workflow.indexOf('id: deploy')<workflow.indexOf('Remove private Cloudflare'));
});
