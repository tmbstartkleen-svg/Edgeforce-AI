import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const read=async p=>fs.readFile(path.join(root,p),'utf8');
const json=async p=>JSON.parse(await read(p));

const pkg=await json('package.json');
const vercel=await json('vercel.json');
const health=await read('src/app/api/health/route.ts');
const deploymentSmoke=await read('src/app/api/deployment/smoke/route.ts');
const migrationCheck=await read('scripts/check-migrations.mjs');

const version=String(pkg.version||'');
const major=Number(version.split('.')[1]||version.split('.')[0]||0);
const apiVersion=version.replace(/^0\./,'')+'.0';
const expectedMigration=Number((migrationCheck.match(/const expected=(\d+);/)||[])[1]||0);
const gitAutoDeployDisabled=vercel?.git?.deploymentEnabled===false;

const checks={
  packageVersion:Boolean(version),
  healthVersion:health.includes("version:'"+apiVersion+"'"),
  deploymentSmokeVersion:deploymentSmoke.includes("version:'"+apiVersion+"'"),
  migrationMatchesVersion:expectedMigration===major,
  allAutomaticVercelGitDeploymentsDisabled:gitAutoDeployDisabled,
  releaseCandidateFlag:health.includes('releaseCandidate:true'),
  failClosedBoard:health.includes('failClosedOfficialBoard:true')
};

const failures=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
const report={
  ok:failures.length===0,
  version,
  apiVersion,
  expectedMigration,
  checks,
  failures
};

console.log(JSON.stringify(report));
if(!report.ok)process.exit(1);
