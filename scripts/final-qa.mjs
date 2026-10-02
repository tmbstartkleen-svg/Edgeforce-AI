import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const read=async p=>fs.readFile(path.join(root,p),'utf8');
const exists=async p=>fs.access(path.join(root,p)).then(()=>true).catch(()=>false);

const requiredFiles=[
  'src/app/page.tsx',
  'src/app/pregame/page.tsx',
  'src/app/replacements/page.tsx',
  'src/app/data-health/page.tsx',
  'src/app/release/page.tsx',
  'src/app/api/health/route.ts',
  'src/app/api/live-board/route.ts',
  'src/app/api/release-readiness/route.ts',
  'src/app/api/release-manifest/route.ts',
  'src/app/api/provider-health/route.ts',
  '.github/workflows/verify.yml',
  '.github/workflows/release-candidate.yml',
  '.github/workflows/deploy-preview.yml',
  '.github/workflows/rollback.yml',
  '.github/workflows/migrate-v22-preview.yml',
  'db/v30.sql'
];

const requiredFileChecks=Object.fromEntries(await Promise.all(requiredFiles.map(async p=>[p,await exists(p)])));
const pkg=JSON.parse(await read('package.json'));
const vercel=JSON.parse(await read('vercel.json'));
const health=await read('src/app/api/health/route.ts');
const smoke=await read('src/app/api/deployment/smoke/route.ts');
const migrationCheck=await read('scripts/check-migrations.mjs');
const verify=await read('.github/workflows/verify.yml');
const releaseWorkflow=await read('.github/workflows/release-candidate.yml');
const previewWorkflow=await read('.github/workflows/deploy-preview.yml');
const rollbackWorkflow=await read('.github/workflows/rollback.yml');
const migrationWorkflow=await read('.github/workflows/migrate-v22-preview.yml');

const expectedVersion='0.30.0';
const apiVersion='30.0.0';
const expectedMigration=30;
const migrationValue=Number((migrationCheck.match(/const expected=(\d+);/)||[])[1]||0);

const checks={
  allRequiredFilesPresent:Object.values(requiredFileChecks).every(Boolean),
  packageVersion:pkg.version===expectedVersion,
  healthVersion:health.includes("version:'"+apiVersion+"'"),
  deploymentSmokeVersion:smoke.includes("version:'"+apiVersion+"'"),
  migrationVersion:migrationValue===expectedMigration,
  automaticVercelGitDeploymentsDisabled:vercel?.git?.deploymentEnabled===false,
  ciIncludesReleaseGate:verify.includes('npm run release-gate'),
  ciIncludesFinalQa:verify.includes('npm run final-qa'),
  releaseWorkflowManualOnly:releaseWorkflow.includes('workflow_dispatch:')&&!releaseWorkflow.includes('\n  push:')&&!releaseWorkflow.includes('\n  pull_request:'),
  previewWorkflowManualOnly:previewWorkflow.includes('workflow_dispatch:')&&!previewWorkflow.includes('\n  push:')&&!previewWorkflow.includes('\n  pull_request:'),
  prebuiltReleaseDeployment:releaseWorkflow.includes('vercel deploy --prebuilt'),
  failClosedBoard:health.includes('failClosedOfficialBoard:true'),
  rollbackWorkflowPresent:requiredFileChecks['.github/workflows/rollback.yml']===true,
  rollbackWorkflowManualOnly:rollbackWorkflow.includes('workflow_dispatch:')&&!rollbackWorkflow.includes('\n  push:')&&!rollbackWorkflow.includes('\n  pull_request:'),
  rollbackRequiresConfirmation:rollbackWorkflow.includes('confirm:')&&rollbackWorkflow.includes('if: 
};

const failures=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
const report={
  ok:failures.length===0,
  expectedVersion,
  apiVersion,
  expectedMigration,
  checks,
  missingFiles:Object.entries(requiredFileChecks).filter(([,ok])=>!ok).map(([p])=>p),
  failures
};

console.log(JSON.stringify(report));
if(!report.ok)process.exit(1);
+'{{ inputs.confirm }}'),
  rollbackCommandPresent:rollbackWorkflow.includes('vercel rollback'),
  migrationWorkflowManualOnly:migrationWorkflow.includes('workflow_dispatch:')&&!migrationWorkflow.includes('\n  push:')&&!migrationWorkflow.includes('\n  pull_request:'),
  migrationRequiresConfirmation:migrationWorkflow.includes('apply:')&&migrationWorkflow.includes('if: 
};

const failures=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
const report={
  ok:failures.length===0,
  expectedVersion,
  apiVersion,
  expectedMigration,
  checks,
  missingFiles:Object.entries(requiredFileChecks).filter(([,ok])=>!ok).map(([p])=>p),
  failures
};

console.log(JSON.stringify(report));
if(!report.ok)process.exit(1);
+'{{ inputs.apply }}')
};

const failures=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
const report={
  ok:failures.length===0,
  expectedVersion,
  apiVersion,
  expectedMigration,
  checks,
  missingFiles:Object.entries(requiredFileChecks).filter(([,ok])=>!ok).map(([p])=>p),
  failures
};

console.log(JSON.stringify(report));
if(!report.ok)process.exit(1);
