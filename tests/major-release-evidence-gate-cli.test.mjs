import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const cli=new URL('../scripts/major-release-evidence-gate.mjs',import.meta.url);
const run=file=>spawnSync(process.execPath,[cli.pathname,file],{encoding:'utf8',timeout:20000});
test('combined offline evidence exports produce stage-by-stage blockers',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'edgeforce-release-evidence-'));
 try{
  const file=join(dir,'evidence.json');
  await writeFile(file,JSON.stringify({stage2:{settledForecasts:[],closingLinePairs:[],
   simultaneousSourceQuotes:[]},draftKings:{events:[],expected:[]}}));
  const result=run(file);
  assert.equal(result.status,3,result.stderr);
  const json=JSON.parse(result.stdout);
  assert.equal(json.ok,true);
  assert.equal(json.missingByStage.length,4);
  assert.equal(json.releaseCertified,false);
  assert.equal(json.productionApproved,false);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('malformed evidence exits nonzero without inventing readiness',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'edgeforce-release-evidence-'));
 try{
  const file=join(dir,'bad.json');
  await writeFile(file,'not-json');
  assert.equal(run(file).status,2);
  await writeFile(file,JSON.stringify({}));
  assert.equal(run(file).status,2);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('release CLI contains no network, deployment or D1 operations',async()=>{
 const src=await readFile(cli,'utf8');
 assert.doesNotMatch(src,/\bfetch\(|INSERT INTO|writeFile\(|wrangler deploy/);
 assert.match(src,/20MB_OR_LESS/);
});
