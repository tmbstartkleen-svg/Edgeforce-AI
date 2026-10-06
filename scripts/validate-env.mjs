const expectedModel='edgeforce-v106';
const requiredBase=['INGEST_SECRET','CRON_SECRET','MODEL_VERSION','DEFAULT_BANKROLL'];
const requiredProduction=[];
const providerGroups=[
 ['ODDS_PROVIDER_PRIMARY_URL','ODDS_PROVIDER_PRIMARY_KEY'],
 ['ODDS_PROVIDER_SECONDARY_URL','ODDS_PROVIDER_SECONDARY_KEY'],
 ['ODDS_PROVIDER_TERTIARY_URL','ODDS_PROVIDER_TERTIARY_KEY']
];

const env=process.env;
const environment=env.DEPLOYMENT_ENV||env.VERCEL_ENV||'local';
const strict=env.REQUIRE_PRODUCTION_ENV==='true'||environment==='production';
const missingBase=requiredBase.filter(k=>!env[k]);
const databaseUrl=env.DATABASE_URL||env.POSTGRES_URL||env.POSTGRES_PRISMA_URL||env.NEON_DATABASE_URL;
const missingProduction=(strict?requiredProduction:[]).filter(k=>!env[k]);
if(strict&&!databaseUrl)missingProduction.push('DATABASE_URL|POSTGRES_URL');
const nativeOdds=Boolean(env.THE_ODDS_API_KEY);
const configuredOdds=providerGroups.filter(group=>group.some(k=>Boolean(env[k])));
const incompleteOdds=configuredOdds.filter(group=>group.some(k=>!env[k]));
const modelVersionOk=env.MODEL_VERSION===expectedModel;
const bankroll=Number(env.DEFAULT_BANKROLL);
const bankrollOk=Number.isFinite(bankroll)&&bankroll>0;
const productionOddsOk=!strict||nativeOdds||configuredOdds.some(group=>group.every(k=>Boolean(env[k])));
const productionRealDataOnly=!strict||env.ALLOW_DEMO_DATA!=='true';

const report={
 ok:missingBase.length===0&&missingProduction.length===0&&incompleteOdds.length===0&&modelVersionOk&&bankrollOk&&productionOddsOk&&productionRealDataOnly,
 strict,
 expectedModel,
 missingBase,
 missingProduction,
 incompleteOdds,
 configuredOddsProviders:configuredOdds.length+(nativeOdds?1:0),
 nativeTheOddsApi:nativeOdds,
 productionOddsOk,
 productionRealDataOnly,
 deploymentPlatform:env.DEPLOYMENT_PLATFORM||null,
 deploymentEnvironment:environment,
 modelVersion:env.MODEL_VERSION||null,
 modelVersionOk,
 bankrollOk,
 vercelEnvironment:env.VERCEL_ENV||null
};

console.log(JSON.stringify(report));
if(!report.ok)process.exit(1);
