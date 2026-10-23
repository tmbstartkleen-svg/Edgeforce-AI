import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const cli=new URL('../scripts/draftkings-catalog-drift.mjs',import.meta.url);
const execute=(a,b)=>spawnSync(process.execPath,[cli.pathname,a,b],{encoding:'utf8',timeout:15000});
const game={sport:'soccer',league:'Premier League',marketType:'h2h',kind:'game'};
test('command reports a newly offered league and returns review-required status',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dk-catalog-drift-'));
 try{
  const a=join(dir,'before.json'),b=join(dir,'after.json');
  await writeFile(a,JSON.stringify({asOf:'2026-10-21T00:00:00Z',sourceId:'reviewed',required:[game]}));
  await writeFile(b,JSON.stringify({asOf:'2026-10-22T00:00:00Z',sourceId:'reviewed',required:[game,{...game,league:'Championship'}]}));
  const r=execute(a,b);
  assert.equal(r.status,3,r.stderr);
  const report=JSON.parse(r.stdout);
  assert.equal(report.addedCount,1);
  assert.equal(report.requiresCatalogReview,true);
  assert.equal(report.releaseCertified,false);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('malformed inputs are rejected',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dk-catalog-drift-'));
 try{
  const a=join(dir,'before.json'),b=join(dir,'after.json');
  await writeFile(a,'{invalid json');
  await writeFile(b,'{}');
  assert.equal(execute(a,b).status,2);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('CLI remains offline and bounded',async()=>{
 const src=await readFile(cli,'utf8');
 assert.doesNotMatch(src,/fetch\(|INSERT INTO|writeFile\(/);
 assert.match(src,/8MB_OR_LESS/);
});
