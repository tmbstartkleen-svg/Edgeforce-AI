import fs from 'node:fs';
import path from 'node:path';

const target=path.resolve('dist/server/wrangler.json');
if(!fs.existsSync(target))throw new Error('generated Wrangler config is missing');
const commit=String(process.env.DEPLOYMENT_COMMIT||process.env.GITHUB_SHA||'');
const workflowRunId=String(process.env.GITHUB_RUN_ID||'');
if(commit.length<7)throw new Error('deployment commit SHA is missing');
if(!workflowRunId)throw new Error('deployment workflow run id is missing');
const config=JSON.parse(fs.readFileSync(target,'utf8'));
config.vars=config.vars&&typeof config.vars==='object'?config.vars:{};
config.vars.DEPLOYMENT_COMMIT=commit;
config.vars.DEPLOYMENT_PLATFORM='cloudflare';
config.vars.DEPLOYMENT_ENV='production';
config.vars.DEPLOYMENT_WORKFLOW_RUN_ID=workflowRunId;
fs.writeFileSync(target,JSON.stringify(config,null,2)+'\n');
console.log(JSON.stringify({ok:true,target:'dist/server/wrangler.json',deploymentCommit:commit,deploymentWorkflowRunId:workflowRunId}));
