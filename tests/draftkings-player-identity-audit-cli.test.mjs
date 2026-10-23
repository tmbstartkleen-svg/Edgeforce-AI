import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const cli=new URL('../scripts/draftkings-player-identity-audit.mjs',import.meta.url);
const run=file=>spawnSync(process.execPath,[cli.pathname,file],{encoding:'utf8',timeout:20000});
const makeEvent=()=>[{id:'nba-game-1',sport_key:'basketball_nba',sport_title:'NBA',
 commence_time:new Date(Date.now()+3600000).toISOString(),bookmakers:[{
 key:'draftkings',last_update:new Date(Date.now()-30000).toISOString(),
 markets:[{key:'player_points',outcomes:[{name:'Over',description:'Example Player',price:-115,point:24.5}]}]}]}];
const roster=[{eventId:'nba-game-1',sport:'basketball_nba',league:'NBA',
 athleteId:'player-123',displayName:'Example Player',teamId:'HOME'}];
test('local CLI can investigate player identity without claiming certified odds',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dk-player-id-'));
 try{
  const path=join(dir,'sample.json');
  await writeFile(path,JSON.stringify({events:makeEvent(),roster}));
  const result=run(path);
  assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(result.stdout);
  assert.equal(report.candidateCount,1);
  assert.equal(report.candidates[0].status,'ROSTER_MATCH_UNVERIFIED');
  assert.equal(report.certifiedProps,0);
  assert.equal(report.identityJoinCertified,false);
  assert.equal(report.releaseCertified,false);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('missing roster and malformed export cannot be promoted to verified player props',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dk-player-id-'));
 try{
  const path=join(dir,'sample.json');
  await writeFile(path,JSON.stringify({events:makeEvent(),roster:[]}));
  const missing=run(path);
  assert.equal(missing.status,3,missing.stderr);
  assert.equal(JSON.parse(missing.stdout).candidateCount,0);
  await writeFile(path,'{garbage');
  assert.equal(run(path).status,2);
  await writeFile(path,'{}');
  assert.equal(run(path).status,2);
 }finally{await rm(dir,{recursive:true,force:true})}
});
