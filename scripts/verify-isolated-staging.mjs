#!/usr/bin/env node
/** Fail closed before ANY staging deploy. Validates generated config and target identity. */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const configured=path.join(root,'artifacts','edgeforce-staging.wrangler.json');
const prod=JSON.parse(fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8'));
if(!fs.existsSync(configured))throw Error('STAGING_CONFIG_NOT_GENERATED');
const c=JSON.parse(fs.readFileSync(configured,'utf8'));
const fail=(name)=>{throw Error('UNSAFE_STAGING_CONFIG:'+name)};
if(c.name!=='edgeforce-ai-cert-staging'||c.name===prod.name)fail('WORKER_NAME');
if(c.vars?.DEPLOYMENT_ENV!=='staging'||c.vars?.ATLAS_SCHEDULE_EXECUTION_ENABLED!=='false')fail('ATLAS_EXECUTION');
if(c.vars?.INTELLIGENCE_D1_WRITE_ENABLED!=='false'||c.vars?.D1_SPORTS_MARKET_ARCHIVE_ENABLED!=='false'||c.vars?.ALLOW_DEMO_DATA!=='false')fail('MUTATION_FLAGS');
for(const k of ['triggers','routes','route','services','account_id'])if(Object.hasOwn(c,k))fail(k);
const keys=['KALSHI_ENABLED','THE_ODDS_API_ENABLED','API_SPORTS_ENABLED','THESPORTSDB_ENABLED','SPORTSCORE_ENABLED'];
for(const key of keys)if(c.vars?.[key]!=='false')fail(key);
const [db]=c.d1_databases||[];
if(c.d1_databases?.length!==1||db?.binding!=='INTELLIGENCE_DB'||!/staging/.test(db.database_name))fail('D1_BINDINGS');
if(prod.d1_databases?.some(p=>p.database_id===db.database_id||p.database_name===db.database_name))fail('PRODUCTION_D1');
if(!c.durable_objects?.bindings?.some(x=>x.name==='ATLAS_MISSION_ROOM'))fail('ATLAS_DO');
if(!c.migrations?.length)fail('DO_MIGRATION');
console.log('PASS: isolated staging identity, D1 target, flags, no production routing or cron.');
console.log('This is STATIC preflight only, NOT live Cloudflare certification.');
