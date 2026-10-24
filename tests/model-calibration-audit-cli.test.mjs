import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const cli=new URL('../scripts/model-calibration-audit.mjs',import.meta.url);
const now=Date.now();
const valid={eventId:'event-1',marketId:'h2h',outcomeId:'home',modelId:'v1',
 modelVersion:'2026-10',probability:0.6,result:1,
 forecastAt:new Date(now-86400000).toISOString(),settledAt:new Date(now-60000).toISOString()};
const run=(file,...args)=>spawnSync(process.execPath,[cli.pathname,file,...args],
 {encoding:'utf8',timeout:15000,env:{...process.env}});
test('calibration CLI audits a permitted local export with no certification claims',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'edgeforce-calibration-'));
 try{
  const file=join(dir,'settled.json');
  await writeFile(file,JSON.stringify({settlements:[valid]}));
  const p=run(file,'--bins=5');
  assert.equal(p.status,0,p.stderr);
  const result=JSON.parse(p.stdout);
  assert.equal(result.ok,true);
  assert.equal(result.sampleSize,1);
  assert.equal(result.binCount,5);
  assert.equal(result.certified,false);
  assert.equal(result.modelAuthorizedForLivePicks,false);
  assert.equal(result.sourceProvenanceVerified,false);
  assert.equal(result.releaseCertified,false);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('calibration CLI rejects broken JSON and invalid options without provider requests',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'edgeforce-calibration-'));
 try{
  const file=join(dir,'bad.json');
  await writeFile(file,'{not json');
  assert.equal(run(file).status,2);
  assert.equal(run(file,'--bins=100').status,2);
  await writeFile(file,'{}');
  assert.equal(run(file).status,2);
  await writeFile(file,'[]');
  assert.equal(run(file).status,3);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('offline calibration export CLI is network-free and does not store results',async()=>{
 const text=await readFile(cli,'utf8');
 assert.doesNotMatch(text,/\bfetch\(|\baxios\b|INSERT INTO|writeFile\(/);
 assert.match(text,/SETTLEMENT_EXPORT_MUST_BE_FILE_8MB_OR_LESS/);
});
