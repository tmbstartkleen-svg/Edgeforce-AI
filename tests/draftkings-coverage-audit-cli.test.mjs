import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const cli=new URL('../scripts/draftkings-coverage-audit.mjs',import.meta.url);
const run=file=>spawnSync(process.execPath,[cli.pathname,file],{encoding:'utf8',timeout:15000});
test('offline missing-market report is useful and remains uncertified',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'edgeforce-dk-coverage-'));
 try{
  const file=join(dir,'coverage.json');
  await writeFile(file,JSON.stringify({expected:[{sport:'soccer',league:'Premier League',marketType:'h2h',kind:'game'}],observed:[]}));
  const r=run(file);assert.equal(r.status,3,r.stderr);
  const report=JSON.parse(r.stdout);
  assert.equal(report.coveredCount,0);assert.equal(report.missingCount,1);
  assert.equal(report.marketCatalogExternallyVerified,false);
  assert.equal(report.releaseCertified,false);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('unknown catalogs and malformed source exports never pass audit',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'edgeforce-dk-coverage-'));
 try{
  const file=join(dir,'coverage.json');
  await writeFile(file,'{not json');
  assert.equal(run(file).status,2);
  await writeFile(file,JSON.stringify({expected:[],observed:[]}));
  assert.equal(run(file).status,3);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('coverage tool uses no provider calls or persistent writes',async()=>{
 const s=await readFile(cli,'utf8');
 assert.doesNotMatch(s,/fetch\(|INSERT INTO|writeFile\(/);
 assert.match(s,/12MB_OR_LESS/);
});
