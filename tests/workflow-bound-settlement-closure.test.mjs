import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const stamp=read('scripts/stamp-cloudflare-deployment.mjs');
const automation=read('src/lib/automationHealth.ts');
const closure=read('src/lib/finalProductionClosure.ts');

test('V176 Worker runtime stamp includes exact production workflow run id',()=>{
 assert.match(stamp,/const workflowRunId=String\(process\.env\.GITHUB_RUN_ID\|\|''\)/);
 assert.match(stamp,/DEPLOYMENT_WORKFLOW_RUN_ID=workflowRunId/);
 assert.match(stamp,/deploymentWorkflowRunId:workflowRunId/);
});

test('V176 automation metadata carries deployment workflow identity',()=>{
 assert.match(automation,/deploymentWorkflowRunId:String\(process\.env\.DEPLOYMENT_WORKFLOW_RUN_ID\|\|''\)\|\|null/);
});

test('V176 final closure binds settlement to current production workflow run',()=>{
 assert.match(closure,/const expectedWorkflowRunId=String\(input\.workflowRunId\|\|topologyEvidence\?\.workflowRunId\|\|''\)/);
 assert.match(closure,/deploymentWorkflowRunId\|\|''\)===expectedWorkflowRunId/);
 assert.match(closure,/&&settlementWorkflowBound/);
 assert.match(closure,/settlement automation evidence is not bound to the current production workflow run/);
});

test('V176 closure evidence records expected and observed workflow ids',()=>{
 assert.match(closure,/settlementWorkflowBound,/);
 assert.match(closure,/settlementExpectedWorkflowRunId:expectedWorkflowRunId\|\|null/);
 assert.match(closure,/settlementWorkflowRunId:settlementMetadata\?\.deploymentWorkflowRunId\|\|null/);
});
