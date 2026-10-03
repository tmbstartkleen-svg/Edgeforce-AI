const expectedModel='edgeforce-v35';
const requiredBase=['INGEST_SECRET','CRON_SECRET','MODEL_VERSION','DEFAULT_BANKROLL'];
const requiredProduction=['DATABASE_URL'];
const providerGroups=[
 ['ODDS_PROVIDER_PRIMARY_URL','ODDS_PROVIDER_PRIMARY_KEY'],
 ['ODDS_PROVIDER_SECONDARY_URL','ODDS_PROVIDER_SECONDARY_KEY'],
 ['ODDS_PROVIDER_TERTIARY_URL','ODDS_PROVIDER_TERTIARY_KEY']
];

const env=process.env;
const strict=env.REQUIRE_PRODUCTION_ENV==='true'||env.VERCEL_ENV==='production';
const missingBase=requiredBase.filter(k=>!env[k]);
const missingProduction=(strict?requiredProduction:[]).filter(k=>!env[k]);
const configuredOdds=providerGroups.filter(group=>group.some(k=>Boolean(env[k])));
const incompleteOdds=configuredOdds.filter(group=>group.some(k=>!env[k]));
const modelVersionOk=env.MODEL_VERSION===expectedModel;
const bankroll=Number(env.DEFAULT_BANKROLL);
const bankrollOk=Number.isFinite(bankroll)&&bankroll>0;
const productionOddsOk=!strict||configuredOdds.some(group=>group.every(k=>Boolean(env[k])));

const report={
 ok:missingBase.length===0&&missingProduction.length===0&&incompleteOdds.length===0&&modelVersionOk&&bankrollOk&&productionOddsOk,
 strict,
 expectedModel,
 missingBase,
 missingProduction,
 incompleteOdds,
 configuredOddsProviders:configuredOdds.length,
 productionOddsOk,
 modelVersion:env.MODEL_VERSION||null,
 modelVersionOk,
 bankrollOk,
 vercelEnvironment:env.VERCEL_ENV||null
};

console.log(JSON.stringify(report));
if(!report.ok)process.exit(1);
