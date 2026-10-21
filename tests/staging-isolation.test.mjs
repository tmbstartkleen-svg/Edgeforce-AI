import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const script=path.join(root,'scripts/build-isolated-staging-config.mjs');
const prod=JSON.parse(fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8'));
const prodId=prod.d1_databases[0].database_id;
const stageId='11111111-2222-4333-8444-555555555555';
const out=path.join(root,'artifacts','edgeforce-staging.wrangler.json');
function run(env){return spawnSync(process.execPath,[script],{cwd:root,env:{...process.env,EDGEFORCE_STAGING_D1_ID:'',...env},encoding:'utf8'});}
test('rejects missing independent staging DB',()=>assert.notEqual(run({}).status,0));
test('refuses production D1 database ID',()=>assert.notEqual(run({EDGEFORCE_STAGING_D1_ID:prodId}).status,0));
test('refuses production D1 name',()=>assert.notEqual(run({EDGEFORCE_STAGING_D1_ID:stageId,EDGEFORCE_STAGING_D1_NAME:prod.d1_databases[0].database_name}).status,0));
test('generates isolated Worker with no triggers, service bindings or production environment variables',()=>{
 const result=run({EDGEFORCE_STAGING_D1_ID:stageId});assert.equal(result.status,0,result.stderr);
 const c=JSON.parse(fs.readFileSync(out,'utf8'));
 assert.equal(c.name,'edgeforce-ai-cert-staging');assert.notEqual(c.name,prod.name);
 assert.equal(c.d1_databases[0].database_id,stageId);assert.notEqual(c.d1_databases[0].database_id,prodId);
 assert.equal(c.vars.ATLAS_SCHEDULE_EXECUTION_ENABLED,'false');
 assert.equal(c.vars.INTELLIGENCE_D1_WRITE_ENABLED,'false');
 assert.equal(c.vars.DEPLOYMENT_ENV,'staging');
 for(const k of ['triggers','routes','route','services','account_id'])assert.equal(c[k],undefined,k);
 fs.rmSync(out,{force:true});
});
