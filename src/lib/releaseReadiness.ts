import {db,dbHealth} from './db';
import {getProductionProviderHealth} from './productionHealth';
import {latestFeedIntegrity} from './feedIntegrityStore';

export type ReleaseReadiness={
  version:string;
  environment:string;
  gitSha:string|null;
  readyForPreview:boolean;
  readyForProduction:boolean;
  blockers:string[];
  warnings:string[];
  checks:{
    databaseConfigured:boolean;
    databaseReachable:boolean;
    latestMigration:number;
    expectedMigration:number;
    modelVersionMatches:boolean;
    ingestSecretConfigured:boolean;
    cronSecretConfigured:boolean;
    liveOddsConfigured:boolean;
    resultsConfigured:boolean;
    playerResultsConfigured:boolean;
    freshHealthyProviders:number;
    configuredProviders:number;
    latestFeedIntegrityStatus:string|null;
    officialFeedEligible:boolean;
  };
};

const expectedMigration=30;
const expectedModel='edgeforce-v30';

export async function getReleaseReadiness():Promise<ReleaseReadiness>{
  const environment=process.env.VERCEL_ENV||process.env.NODE_ENV||'local';
  const gitSha=process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||null;
  const database=await dbHealth();
  const sql=db();

  let latestMigration=0;
  if(sql&&database.ok){
    try{
      const rows=await sql`
        select coalesce(max(regexp_replace(version,'[^0-9]','','g')::int),0)::int as version
        from schema_migrations
      ` as unknown as Array<{version:number}>;
      latestMigration=Number(rows[0]?.version||0);
    }catch{}
  }

  const providerHealth=await getProductionProviderHealth().catch(()=>({
    databaseConfigured:Boolean(sql),
    rows:[],
    counts:{configured:0,healthy:0,degraded:0,unhealthy:0,unknown:0},
    generatedAt:new Date().toISOString()
  }));
  const integrity=(await latestFeedIntegrity(1).catch(()=>[] as any[]))[0] as any|undefined;

  const modelVersionMatches=(process.env.MODEL_VERSION||'')===expectedModel;
  const ingestSecretConfigured=Boolean(process.env.INGEST_SECRET);
  const cronSecretConfigured=Boolean(process.env.CRON_SECRET);
  const liveOddsConfigured=Boolean(
    process.env.SHARP_API_KEY||
    process.env.THE_ODDS_API_KEY||
    (process.env.ODDS_PROVIDER_PRIMARY_URL&&process.env.ODDS_PROVIDER_PRIMARY_KEY)
  );
  const resultsConfigured=Boolean(
    process.env.RESULTS_PROVIDER_PRIMARY_URL||
    process.env.THE_ODDS_API_KEY
  );
  const playerResultsConfigured=Boolean(
    process.env.PLAYER_RESULTS_PROVIDER_URL||
    process.env.STATS_PROVIDER_PRIMARY_URL
  );
  const officialFeedEligible=Boolean(integrity?.officialEligible);

  const blockers:string[]=[];
  const warnings:string[]=[];

  if(!database.configured)blockers.push('DATABASE_URL is not configured');
  else if(!database.ok)blockers.push('Database is configured but unreachable');
  if(latestMigration<expectedMigration)blockers.push('Database migrations are behind V29');
  if(!modelVersionMatches)blockers.push('MODEL_VERSION must be edgeforce-v30');
  if(!ingestSecretConfigured)blockers.push('INGEST_SECRET is not configured');
  if(!cronSecretConfigured)blockers.push('CRON_SECRET is not configured');
  if(!liveOddsConfigured)blockers.push('No live odds provider is configured');

  if(!resultsConfigured)warnings.push('Completed-event result feed is not configured');
  if(!playerResultsConfigured)warnings.push('Player-stat result feed is not configured');
  if(providerHealth.counts.healthy<1)warnings.push('No provider currently has a fresh healthy status');
  if(!integrity)warnings.push('No production feed-integrity snapshot has been recorded yet');
  else if(!officialFeedEligible)warnings.push('Latest feed-integrity gate blocks the official board');

  const readyForPreview=blockers.length===0;
  const readyForProduction=readyForPreview&&officialFeedEligible&&providerHealth.counts.healthy>=1;

  return {
    version:'30.0.0',
    environment,
    gitSha,
    readyForPreview,
    readyForProduction,
    blockers,
    warnings,
    checks:{
      databaseConfigured:database.configured,
      databaseReachable:database.ok,
      latestMigration,
      expectedMigration,
      modelVersionMatches,
      ingestSecretConfigured,
      cronSecretConfigured,
      liveOddsConfigured,
      resultsConfigured,
      playerResultsConfigured,
      freshHealthyProviders:providerHealth.counts.healthy,
      configuredProviders:providerHealth.counts.configured,
      latestFeedIntegrityStatus:integrity?.status??null,
      officialFeedEligible
    }
  };
}

export async function recordReleaseAudit(readiness:ReleaseReadiness){
  const sql=db();
  if(!sql)return {configured:false,written:false};
  await sql`
    insert into release_audits(
      release_version,git_sha,environment,ready_for_preview,ready_for_production,blockers,warnings,checks
    ) values(
      ${readiness.version},${readiness.gitSha},${readiness.environment},${readiness.readyForPreview},${readiness.readyForProduction},
      ${sql.json(readiness.blockers as any)},${sql.json(readiness.warnings as any)},${sql.json(readiness.checks as any)}
    )
  `;
  return {configured:true,written:true};
}
