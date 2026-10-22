#!/usr/bin/env node
// Produces a deployable staging config alongside the actual compiled Worker bundle.
// Fail closed: never inherit production databases, routes, cron, secrets or feature flags.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd();
const build=path.join(root,'dist/server/wrangler.json');
if(!fs.existsSync(build))throw Error('BUILD_REQUIRED: run npm run build:vinext');
const generator=spawnSync(process.execPath,['scripts/build-isolated-staging-config.mjs'],{cwd:root,stdio:'inherit',env:process.env});
if(generator.status!==0)throw Error('STAGING_CONFIG_GENERATION_FAILED');
const base=JSON.parse(fs.readFileSync(build,'utf8'));
const safe=JSON.parse(fs.readFileSync(path.join(root,'artifacts/edgeforce-staging.wrangler.json'),'utf8'));
const prod=JSON.parse(fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8'));
const id=safe.d1_databases?.[0]?.database_id;
if(!id||prod.d1_databases?.some(d=>d.database_id===id))throw Error('PRODUCTION_DATABASE_REJECTED');
if(safe.name!=='edgeforce-ai-cert-staging'||safe.vars?.ATLAS_SCHEDULE_EXECUTION_ENABLED!=='false')throw Error('UNSAFE_STAGING_POLICY');
const staging={
 $schema:base.$schema,
 name:safe.name,
 main:base.main,
 compatibility_date:base.compatibility_date||safe.compatibility_date,
 compatibility_flags:base.compatibility_flags||safe.compatibility_flags,
 workers_dev:true,
 preview_urls:false,
 observability:safe.observability,
 vars:safe.vars,
 d1_databases:safe.d1_databases,
 durable_objects:safe.durable_objects,
 migrations:safe.migrations
};
// Static assets produced by the build are allowed; all other bindings must be explicitly vetted.
if(base.assets)staging.assets=base.assets;
if(!staging.main||!fs.existsSync(path.resolve(path.dirname(build),staging.main)))throw Error('COMPILED_ENTRY_MISSING');
if(Object.keys(staging).some(k=>['routes','route','triggers','services','queues','kv_namespaces','r2_buckets'].includes(k)))throw Error('STAGING_SURFACE_FORBIDDEN');
const out=path.join(root,'dist/server/wrangler.staging.json');
fs.writeFileSync(out,JSON.stringify(staging,null,2)+'\n',{mode:0o600});
console.log('Staging-only compiled Worker config: dist/server/wrangler.staging.json');
console.log('Safe staging Worker: '+staging.name+'; D1: '+id+'; scheduled execution: disabled');
