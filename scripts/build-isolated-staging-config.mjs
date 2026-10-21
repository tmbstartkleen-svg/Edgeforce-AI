#!/usr/bin/env node
/* Generate a staging-only Wrangler config. Never derives the staging D1 binding from production. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const prod=JSON.parse(fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8'));
const stageId=process.env.EDGEFORCE_STAGING_D1_ID||'';
const stageName=process.env.EDGEFORCE_STAGING_D1_NAME||'edgeforce-intelligence-staging';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if(!uuid.test(stageId))throw Error('STAGING_D1_ID_REQUIRED: provide independently provisioned UUID');
if(!/^edgeforce-[a-z0-9-]*staging[a-z0-9-]*$/.test(stageName))throw Error('STAGING_D1_NAME_INVALID');
if(prod.d1_databases?.some(d=>d.database_id.toLowerCase()===stageId.toLowerCase()||d.database_name===stageName))
 throw Error('STAGING_DATABASE_EQUALS_PRODUCTION');
const config={
 $schema:prod.$schema,
 name:'edgeforce-ai-cert-staging',
 compatibility_date:prod.compatibility_date,
 compatibility_flags:prod.compatibility_flags,
 main:prod.main,
 workers_dev:true,
 preview_urls:false,
 observability:{enabled:true},
 vars:{
  DEPLOYMENT_PLATFORM:'cloudflare',
  DEPLOYMENT_ENV:'staging',
  ATLAS_SCHEDULE_EXECUTION_ENABLED:'false',
  INTELLIGENCE_D1_WRITE_ENABLED:'false',
  ALLOW_DEMO_DATA:'false',
  KALSHI_ENABLED:'false',
  THE_ODDS_API_ENABLED:'false',
  API_SPORTS_ENABLED:'false',
  THESPORTSDB_ENABLED:'false',
  SPORTSCORE_ENABLED:'false'
 },
 d1_databases:[{binding:'INTELLIGENCE_DB',database_name:stageName,database_id:stageId}],
 durable_objects:{bindings:[{name:'ATLAS_MISSION_ROOM',class_name:'AtlasMissionRoom'}]},
 migrations:prod.migrations||[{tag:'atlas-mission-room-v1',new_sqlite_classes:['AtlasMissionRoom']}]
};
// No production routes, custom domains, cron triggers, service bindings or inherited secrets.
const output=path.join(root,'artifacts','edgeforce-staging.wrangler.json');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(config,null,2)+'\n',{mode:0o600});
console.log('Isolated staging config generated at artifacts/edgeforce-staging.wrangler.json');
console.log('Staging worker: '+config.name+'; data: '+stageName+'; scheduled execution disabled.');
