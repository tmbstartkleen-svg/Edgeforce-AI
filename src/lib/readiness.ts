import {dbHealth} from './db';
import {configuredProviders} from './providers/config';
import {loadProviderHealthStates} from './providers/healthStore';
import {providerHealth} from './providerRegistry';
import {RELEASE} from './releaseManifest';

export type ReadinessCheck={ok:boolean;required:boolean;detail:string};

function positiveNumber(value:string|undefined){
 const n=Number(value);
 return Number.isFinite(n)&&n>0;
}

export async function evaluateReadiness(options:{strict?:boolean}={}){
 const environment=process.env.VERCEL_ENV||'local';
 const strict=options.strict??(environment==='production'||process.env.REQUIRE_PRODUCTION_ENV==='true');
 const [database,states]=await Promise.all([dbHealth(),loadProviderHealthStates()]);
 const providers=configuredProviders();
 const odds=providers.filter(p=>p.capability==='ODDS');
 const operationalOdds=odds.filter(p=>{
  const state=states.get(p.id);
  return !state||!providerHealth(state).quarantined;
 });

 const checks:Record<string,ReadinessCheck>={
  modelVersion:{
   ok:!process.env.MODEL_VERSION||process.env.MODEL_VERSION===RELEASE.modelVersion,
   required:strict,
   detail:process.env.MODEL_VERSION||'not set'
  },
  database:{
   ok:database.configured?database.ok:!strict,
   required:strict,
   detail:database.configured?(database.ok?'connected':database.error||'unhealthy'):'not configured'
  },
  ingestSecret:{
   ok:Boolean(process.env.INGEST_SECRET)||!strict,
   required:strict,
   detail:process.env.INGEST_SECRET?'configured':'not configured'
  },
  cronSecret:{
   ok:Boolean(process.env.CRON_SECRET)||!strict,
   required:strict,
   detail:process.env.CRON_SECRET?'configured':'not configured'
  },
  bankroll:{
   ok:positiveNumber(process.env.DEFAULT_BANKROLL)||!strict,
   required:strict,
   detail:process.env.DEFAULT_BANKROLL||'not configured'
  },
  oddsProvider:{
   ok:operationalOdds.length>0||!strict,
   required:strict,
   detail:`${operationalOdds.length} operational / ${odds.length} configured`
  }
 };

 const requiredFailures=Object.entries(checks).filter(([,x])=>x.required&&!x.ok).map(([name])=>name);
 const warnings=Object.entries(checks).filter(([,x])=>!x.ok&&!x.required).map(([name,x])=>`${name}: ${x.detail}`);
 const productionReady=Object.values(checks).every(x=>x.ok||!x.required);
 const appReady=(database.configured?database.ok:true)&&checks.modelVersion.ok;

 return {
  ready:strict?productionReady:appReady,
  productionReady,
  strict,
  build:RELEASE.build,
  version:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  migrationVersion:RELEASE.migrationVersion,
  environment,
  checks,
  requiredFailures,
  warnings,
  database,
  providers:{
   configured:providers.length,
   oddsConfigured:odds.length,
   oddsOperational:operationalOdds.length,
   quarantined:[...states.values()].filter(x=>providerHealth(x).quarantined).map(x=>x.id)
  },
  deployment:{
   vercel:Boolean(process.env.VERCEL),
   url:process.env.VERCEL_URL||null,
   commit:process.env.VERCEL_GIT_COMMIT_SHA||null
  },
  time:new Date().toISOString()
 };
}
