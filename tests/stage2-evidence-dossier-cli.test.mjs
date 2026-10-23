import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=new URL('../scripts/stage2-evidence-dossier.mjs',import.meta.url);
const run=file=>spawnSync(process.execPath,[script.pathname,file],{encoding:'utf8',timeout:15000});
test('evidence dossier CLI produces actionable blockers for empty legitimate exports',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'edgeforce-stage2-'));
 try{
  const file=join(dir,'bundle.json');
  await writeFile(file,JSON.stringify({settledForecasts:[],closingLinePairs:[],simultaneousSourceQuotes:[]}));
  const result=run(file);
  assert.equal(result.status,3,result.stderr);
  const json=JSON.parse(result.stdout);
  assert.equal(json.ok,true);
  assert.equal(json.stage2Certified,false);
  assert.equal(json.productionReady,false);
  assert.ok(json.deficiencies.includes('SOURCE_AUTHENTICITY_AND_ENTITLEMENT'));
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('dossier CLI rejects malformed and unsupplied evidence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'edgeforce-stage2-'));
 try{
  const file=join(dir,'bundle.json');
  await writeFile(file,'{bad');
  assert.equal(run(file).status,2);
  await writeFile(file,'{}');
  assert.equal(run(file).status,2);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('offline tool has no network or write side effects',async()=>{
 const text=await readFile(script,'utf8');
 assert.doesNotMatch(text,/\bfetch\(|INSERT INTO|writeFile\(|axios/);
 assert.match(text,/12MB_OR_LESS/);
});
