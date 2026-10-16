import fs from 'node:fs';
const load=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));
function getId(c){const items=c.d1_databases??[];return items.find(x=>x.binding==='INTELLIGENCE_DB')?.database_id;}
const pilot=load('wrangler.d1-pilot.jsonc'),production=load('wrangler.jsonc');
const pilotId=getId(pilot),productionId=getId(production);
const isolated=Boolean(pilotId&&productionId&&pilotId!==productionId);
console.log(JSON.stringify({pilotDatabaseName:pilot.d1_databases?.[0]?.database_name,productionDatabaseName:production.d1_databases?.[0]?.database_name,pilotDatabaseConfigured:Boolean(pilotId),productionDatabaseConfigured:Boolean(productionId),isolated,additiveSchemaMigrationsReady:isolated,productionCutoverAuthorized:false},null,2));
if(!isolated){console.error('D1_PILOT_DATABASE_SHARED_OR_UNCONFIGURED: create a dedicated pilot D1 database and update only wrangler.d1-pilot.jsonc before any migration.');process.exitCode=1;}
