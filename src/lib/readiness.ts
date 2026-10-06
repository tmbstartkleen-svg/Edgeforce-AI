import {db,dbHealth} from './db';
import {configuredProviders} from './providers/config';
import {loadProviderHealthStates} from './providers/healthStore';
import {providerHealth} from './providerRegistry';
import {RELEASE} from './releaseManifest';
import {latestProviderCertification} from './providerCertification';

export type ReadinessCheck={ok:boolean;required:boolean;detail:string};

function positiveNumber(value:string|undefined){
 const n=Number(value);
 return Number.isFinite(n)&&n>0;
}

export async function evaluateReadiness(options:{strict?:boolean}={}){
 const platform=process.env.DEPLOYMENT_PLATFORM||(process.env.VERCEL?'vercel':'local');
 const environment=process.env.DEPLOYMENT_ENV||process.env.VERCEL_ENV||'local';
 const strict=options.strict??(environment==='production'||process.env.REQUIRE_PRODUCTION_ENV==='true');
 const [database,states,certification]=await Promise.all([dbHealth(),loadProviderHealthStates(),latestProviderCertification()]);
 const sql=db();
 let migrationApplied=!database.configured;
 if(sql&&database.ok){
  try{
   const rows=await sql`select version from schema_migrations where version=${'v'+RELEASE.migrationVersion} limit 1`;
   migrationApplied=rows.length>0;
  }catch{
   migrationApplied=false;
  }
 }
 const providers=configuredProviders();
 const odds=providers.filter(p=>p.capability==='ODDS');
 const operationalOdds=odds.filter(p=>{
  const state=states.get(p.id);
  return !state||!providerHealth(state).quarantined;
 });
 const continuityProviders=(certification?.providers||[]).filter(row=>{
  const providerId=String(row.providerId||'');
  const status=String(row.status||'');
  const capability=String(row.capability||'');
  const checkedAt=row.checkedAt?new Date(String(row.checkedAt)).getTime():0;
  const maxAgeMin=Math.max(1,Number(row.maxAgeMin||2));
  const payloadAgeMin=Math.max(0,Number(row.payloadAgeMin||0));
  const checkedAgeMin=checkedAt?Math.max(0,(Date.now()-checkedAt)/60000):Number.POSITIVE_INFINITY;
  return certification?.releaseVersion===RELEASE.appVersion
   &&certification.launchReady===true
   &&capability==='ODDS'
   &&status==='CERTIFIED'
   &&['fanlinewire-fanduel-pulse','persisted-live-odds'].includes(providerId)
   &&payloadAgeMin<=maxAgeMin
   &&checkedAgeMin<=maxAgeMin;
 });
 const certifiedOddsContinuity=continuityProviders.length>0;

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
  migration:{
   ok:migrationApplied||!strict,
   required:strict,
   detail:migrationApplied?`v${RELEASE.migrationVersion} applied`:`v${RELEASE.migrationVersion} not detected`
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
   ok:operationalOdds.length>0||certifiedOddsContinuity||!strict,
   required:strict,
   detail:`${operationalOdds.length} operational / ${odds.length} configured${certifiedOddsContinuity?`; certified continuity ${continuityProviders.map(x=>String(x.providerId)).join(', ')}`:''}`
  },
  productionRealDataOnly:{
   ok:process.env.ALLOW_DEMO_DATA!=='true'||!strict,
   required:strict,
   detail:process.env.ALLOW_DEMO_DATA==='true'?'demo fallback enabled':'demo fallback disabled'
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
   certifiedContinuity:certifiedOddsContinuity,
   continuityProviders:continuityProviders.map(x=>String(x.providerId)),
   quarantined:[...states.values()].filter(x=>providerHealth(x).quarantined).map(x=>x.id)
  },
  deployment:{
   platform,
   environment,
   vercel:platform==='vercel'||Boolean(process.env.VERCEL),
   cloudflare:platform==='cloudflare',
   url:process.env.DEPLOYMENT_URL||process.env.VERCEL_URL||null,
   commit:process.env.DEPLOYMENT_COMMIT||process.env.VERCEL_GIT_COMMIT_SHA||null
  },
  time:new Date().toISOString()
 };
}
