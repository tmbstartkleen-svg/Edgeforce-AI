const requiredBase=[
 'INGEST_SECRET',
 'CRON_SECRET',
 'MODEL_VERSION',
 'DEFAULT_BANKROLL'
];

const requiredProduction=[
 'DATABASE_URL'
];

const providerGroups=[
 ['ODDS_PROVIDER_PRIMARY_URL','ODDS_PROVIDER_PRIMARY_KEY'],
 ['ODDS_PROVIDER_SECONDARY_URL','ODDS_PROVIDER_SECONDARY_KEY'],
 ['ODDS_PROVIDER_TERTIARY_URL','ODDS_PROVIDER_TERTIARY_KEY']
];

const env=process.env;
const missingBase=requiredBase.filter(k=>!env[k]);
const missingProduction=(env.REQUIRE_PRODUCTION_ENV==='true'?requiredProduction:[]).filter(k=>!env[k]);
const configuredOdds=providerGroups.filter(group=>group.some(k=>Boolean(env[k])));
const incompleteOdds=configuredOdds.filter(group=>group.some(k=>!env[k]));

const expectedModelVersion=env.EXPECTED_MODEL_VERSION||null;
const modelVersionMatches=!expectedModelVersion||env.MODEL_VERSION===expectedModelVersion;

const report={
 ok:missingBase.length===0&&missingProduction.length===0&&incompleteOdds.length===0&&modelVersionMatches,
 missingBase,
 missingProduction,
 incompleteOdds,
 configuredOddsProviders:configuredOdds.length,
 modelVersion:env.MODEL_VERSION||null,
 expectedModelVersion,
 modelVersionMatches,
 vercelEnvironment:env.VERCEL_ENV||null
};

console.log(JSON.stringify(report));
if(!report.ok)process.exit(1);
