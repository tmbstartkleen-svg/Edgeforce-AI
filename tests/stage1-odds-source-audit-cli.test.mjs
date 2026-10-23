import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const cli=new URL('../scripts/stage1-odds-source-audit.mjs',import.meta.url);
const run=file=>spawnSync(process.execPath,[cli.pathname,file],{encoding:'utf8',timeout:15000});
test('offline audit surfaces scoreboard-only D1 registry and missing odds',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'edgeforce-d1-registry-'));
 try{
  const file=join(dir,'sources.json');
  await writeFile(file,JSON.stringify({sources:[
   {source_id:'espn-scoreboard-nfl',upstream_id:'site.api.espn.com',source_type:'scoreboard',enabled:1},
   {source_id:'cert',upstream_id:'cert',source_type:'CERTIFICATION_ONLY',enabled:0}
  ],storedOddsRows:0}));
  const result=run(file);
  assert.equal(result.status,3,result.stderr);
  const report=JSON.parse(result.stdout);
  assert.equal(report.enabledSportsbookSources,0);
  assert.equal(report.storedOddsRows,0);
  assert.ok(report.blockers.includes('NO_ENABLED_SPORTSBOOK_ODDS_SOURCE'));
  assert.equal(report.releaseCertified,false);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('malformed local inventory exits nonzero with no write or deployment',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'edgeforce-d1-registry-'));
 try{
  const file=join(dir,'sources.json');
  await writeFile(file,'{oops');
  assert.equal(run(file).status,2);
  await writeFile(file,'{}');
  assert.equal(run(file).status,2);
 }finally{await rm(dir,{recursive:true,force:true})}
 const src=await readFile(cli,'utf8');
 assert.doesNotMatch(src,/fetch\(|INSERT INTO|wrangler|writeFile\(/);
});
