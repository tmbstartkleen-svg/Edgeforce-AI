import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/deploy-cloudflare.yml',import.meta.url),'utf8');

test('V180 validates certificate chain before writing external closure receipt',()=>{
 const closure=workflow.indexOf('Attempt final production closure');
 const upload=workflow.indexOf('Upload final closure receipt');
 const publish=workflow.indexOf('Publish deployment URL');
 assert.ok(closure>=0);
 assert.ok(upload>closure);
 assert.ok(publish>upload);
 assert.match(workflow,/\.diagnostics\.certificateChain\.valid==true/);
 assert.match(workflow,/\^\[a-f0-9\]\{64\}\$/);
 assert.match(workflow,/certificateHead:\$certificateHead/);
 assert.match(workflow,/certificateCount:\$certificateCount/);
});

test('V180 closure receipt is bound to release commit and workflow run',()=>{
 assert.match(workflow,/--arg commitSha "\$\(jq -r '\.report\.commitSha \/\/ empty'/);
 assert.match(workflow,/--arg workflowRunId "\$\(jq -r '\.report\.workflowRunId \/\/ empty'/);
 assert.match(workflow,/Workflow run: \*\*\$GITHUB_RUN_ID\*\*/);
});

test('V180 uploads closure receipt as a retained GitHub Actions artifact',()=>{
 assert.match(workflow,/name: edgeforce-final-closure-receipt-\$\{\{ env\.DEPLOY_COMMIT \}\}-\$\{\{ github\.run_id \}\}/);
 assert.match(workflow,/path: \/tmp\/final-closure-receipt\.json/);
 assert.match(workflow,/if-no-files-found: error/);
 assert.match(workflow,/retention-days: 30/);
});

test('V180 receipt payload contains no runtime secret values',()=>{
 const start=workflow.indexOf("jq -cn \\\n            --arg releaseVersion");
 const end=workflow.indexOf('> /tmp/final-closure-receipt.json',start);
 assert.ok(start>=0&&end>start);
 const block=workflow.slice(start,end);
 assert.doesNotMatch(block,/INGEST_SECRET|CRON_SECRET|DATABASE_URL|API_KEY|TOKEN/);
});
