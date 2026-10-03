import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const expected={
 build:'V48',
 appVersion:'48.0.0',
 packageVersion:'0.48.0',
 modelVersion:'edgeforce-v48',
 migrationVersion:38
};
const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok:Boolean(ok),detail});

const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const exists=(p)=>fs.existsSync(path.join(root,p));

const pkg=JSON.parse(read('package.json'));
const manifest=read('src/lib/releaseManifest.ts');
const envExample=read('.env.example');
const smoke=read('scripts/smoke.mjs');
const remoteSmoke=read('scripts/remote-smoke.mjs');
const migrationCheck=read('scripts/check-migrations.mjs');
const validateEnv=read('scripts/validate-env.mjs');
const security=read('src/lib/security.ts');
const proxy=read('src/proxy.ts');
const vercel=JSON.parse(read('vercel.json'));
const wrangler=read('wrangler.jsonc');

add('package version',pkg.version===expected.packageVersion,`${pkg.version} expected ${expected.packageVersion}`);
add('release build',manifest.includes(`build:'${expected.build}'`),expected.build);
add('release app version',manifest.includes(`appVersion:'${expected.appVersion}'`),expected.appVersion);
add('release package version',manifest.includes(`packageVersion:'${expected.packageVersion}'`),expected.packageVersion);
add('release model version',manifest.includes(`modelVersion:'${expected.modelVersion}'`),expected.modelVersion);
add('release migration version',manifest.includes(`migrationVersion:${expected.migrationVersion}`),String(expected.migrationVersion));
add('env example model identity',envExample.includes(`MODEL_VERSION=${expected.modelVersion}`),expected.modelVersion);
add('local smoke app identity',smoke.includes(expected.appVersion)&&smoke.includes(expected.modelVersion),'smoke identity');
add('hosted smoke app identity',remoteSmoke.includes(expected.appVersion),'remote smoke identity');
add('migration checker identity',migrationCheck.includes(`const expected=${expected.migrationVersion};`),`expected=${expected.migrationVersion}`);
add('environment validator model identity',validateEnv.includes(`const expectedModel='${expected.modelVersion}'`),expected.modelVersion);
add('latest migration exists',exists(`db/v${expected.migrationVersion}.sql`),`db/v${expected.migrationVersion}.sql`);

const requiredFiles=[
 'src/app/api/release/certify/route.ts',
 'src/app/api/automation/health/route.ts',
 'src/app/api/testing/data-contract/route.ts',
 'src/app/api/testing/automation-health/route.ts',
 'src/app/api/testing/security-hardening/route.ts',
 'src/lib/productionCertification.ts',
 'src/lib/automationHealth.ts',
 'src/lib/modelGovernance.ts',
 'src/app/api/intelligence/model-governance/route.ts',
 'src/app/api/testing/model-governance/route.ts',
 'src/lib/providers/theOddsApi.ts',
 'src/lib/providers/polymarket.ts',
 'src/lib/runtimeMigrations.ts',
 'src/app/api/release/bootstrap/route.ts',
 'scripts/cloudflare-preflight.mjs',
 'scripts/validate-cloudflare-build.mjs',
 'scripts/configure-cloudflare-live.mjs',
 'worker/index.ts',
 'src/app/api/live-data/status/route.ts',
 'src/lib/sharedEventState.ts',
 'src/lib/providers/oddsRefreshPolicy.ts',
 'src/app/api/testing/odds-refresh-policy/route.ts',
 'src/app/api/testing/parlay-fallback/route.ts',
 'src/app/api/testing/recommendation-quality/route.ts'
];
for(const file of requiredFiles)add(`required file ${file}`,exists(file),file);
add('native real odds adapter',read('src/lib/providers/config.ts').includes('THE_ODDS_API_KEY')&&read('src/lib/providers/http.ts').includes('the-odds-api://live-board'),'The Odds API wired into provider system');
add('budget-safe odds bootstrap',read('src/lib/providers/theOddsApi.ts').includes("/sports/upcoming/odds")&&!read('src/lib/providers/theOddsApi.ts').includes('mapBatches('),'single upcoming odds request avoids all-sports event fan-out');
add('adaptive full-slate policy',read('src/lib/providers/theOddsApi.ts').includes('adaptiveOddsPolicy')&&read('src/lib/providers/oddsRefreshPolicy.ts').includes("mode:'BOOTSTRAP_ONLY'|'CONSERVE'|'BALANCED'|'EXPANDED'"),'quota-aware sport expansion is active');
add('live parlay API',read('src/app/api/parlays/route.ts').includes('ingestOdds()')&&!read('src/app/api/parlays/route.ts').includes('demoMarkets'),'parlay generation uses production ingestion');
add('transparent parlay fallback',read('src/lib/parlays.ts').includes('WATCH_FALLBACK')&&read('src/app/api/parlays/route.ts').includes('gradeCounts'),'parlay fallback is labeled and diagnosed');
add('recommendation quality tiers',read('src/lib/parlays.ts').includes("'RECOMMENDED'|'VALUE_WATCHLIST'|'HAIL_MARY'|'REJECTED'")&&read('src/app/api/parlays/route.ts').includes('valueWatchlist')&&read('src/app/api/parlays/route.ts').includes('hailMary'),'recommended, watchlist, longshot and rejected tiers are explicit');
add('recommendation risk gates',read('src/lib/parlays.ts').includes('recommendedMinContextCoverage')&&read('src/lib/parlays.ts').includes('MODEL_SIM_DIVERGENCE')&&read('src/lib/parlays.ts').includes('NEGATIVE_EXPECTED_VALUE'),'context, divergence and EV gates protect recommendations');
add('V48 dashboard tiers',read('src/components/Dashboard.tsx').includes('V48 RECOMMENDATION QUALITY')&&read('src/components/Dashboard.tsx').includes('HAIL MARY'),'recommendation tiers are visible in the dashboard');
add('health runtime identity',read('src/app/api/health/route.ts').includes('releaseIdentityMatch')&&read('src/app/api/health/route.ts').includes('Cloudflare-CDN-Cache-Control'),'health exposes runtime/release identity and disables edge caching');
add('persisted odds reuse',read('src/lib/providers/ingest.ts').includes('stored-live-snapshot')&&read('src/app/api/live-data/status/route.ts').includes('forceLive:requireLive'),'normal reads reuse persisted snapshots while explicit live verification bypasses cache');
add('Neon env fallback',read('src/lib/db.ts').includes('POSTGRES_URL'),'runtime DB accepts Neon integration vars');
add('runtime migration bootstrap',read('src/app/api/release/bootstrap/route.ts').includes('runRuntimeMigrations'),'post-deploy migrations run with Vercel runtime secrets');
add('governance migration schema',read('db/v38.sql').includes('model_governance_snapshots')&&read('db/v38.sql').includes('model_governance_runs'),'v38 governance tables');
add('governance runtime brake',read('src/lib/learnedWeights.ts').includes('loadGovernanceMultipliers'),'learned weights consume governance');
add('governance scheduled rebuild',read('src/app/api/cron/recalibrate/route.ts').includes('runModelGovernance'),'recalibration runs governance');
add('Cloudflare runtime platform identity',wrangler.includes('"DEPLOYMENT_PLATFORM": "cloudflare"'),'Cloudflare production platform is explicit');
add('Cloudflare runtime environment identity',wrangler.includes('"DEPLOYMENT_ENV": "production"'),'Cloudflare production environment is explicit');
add('Cloudflare model identity',wrangler.includes('"MODEL_VERSION": "edgeforce-v48"'),'edgeforce-v48');
add('Cloudflare account target',wrangler.includes('"account_id": "de9b84b39940a0b5b622ae5d27b415dc"'),'selected Cloudflare account is pinned');
add('Cloudflare custom Worker entry',wrangler.includes('"main": "./worker/index.ts"'),'custom fetch + scheduled entrypoint');
add('Cloudflare hourly autopilot cron',wrangler.includes('"0 * * * *"'),'hourly live-data automation');
add('Cloudflare daily certification cron',wrangler.includes('"15 6 * * *"'),'daily recalibration and provider certification');
add('Cloudflare production demo disabled',wrangler.includes('"ALLOW_DEMO_DATA": "false"'),'production never substitutes demo odds');
add('production ingestion rejects demo fallback',read('src/lib/providers/ingest.ts').includes("source:'unavailable' as const")&&read('src/lib/providers/ingest.ts').includes('ALLOW_DEMO_DATA'),'production unavailable state is explicit');
add('public scan uses live ingestion',read('src/app/api/scan/route.ts').includes("ingestOdds"),'scan is not demo-backed');
add('decision automation uses live ingestion',read('src/app/api/cron/decision/route.ts').includes("ingestOdds")&&!read('src/app/api/cron/decision/route.ts').includes("demoMarkets"),'decision automation is real-data only');
add('live data status endpoint',read('src/app/api/live-data/status/route.ts').includes("connected:ingestion.source==='live'"),'live connection status exposed');
add('shared event-state joint engine',read('src/lib/eventJointSimulation.ts').includes('runSharedEventStateSimulation')&&read('src/lib/sharedEventState.ts').includes("engine:'SHARED_EVENT_STATE'"),'same-game legs share one event scenario');
add('shared event-state regression',read('src/app/api/testing/joint-simulation/route.ts').includes("shared.engine==='SHARED_EVENT_STATE'"),'CI guards joint engine routing');
add('Cloudflare autopilot Worker',read('worker/index.ts').includes("handler from 'vinext/server/fetch-handler'")&&read('worker/index.ts').includes('scheduled'),'custom Worker delegates HTTP and handles cron');
add('Cloudflare local preflight placeholder guard',read('scripts/cloudflare-preflight.mjs').includes('PASTE_YOUR_ACCOUNT_ID_HERE'),'placeholder account IDs are rejected');
add('Cloudflare generated build validation',read('scripts/validate-cloudflare-build.mjs').includes('dist/server/wrangler.json'),'generated Worker config is validated');
add('Cloudflare deploy script uses generated config',String(pkg.scripts?.['deploy:cloudflare']||'').includes('dist/server/wrangler.json')&&String(pkg.scripts?.['deploy:cloudflare']||'').includes('preflight:cloudflare'),'safe local Cloudflare deploy path');
add('vinext clean build',String(pkg.scripts?.['build:vinext']||'').includes('clean:build')&&read('scripts/clean-build.mjs').includes("['dist','.next','.vinext']"),'stale generated route artifacts are removed before Worker builds');
add('parlay route artifact identity',read('src/app/api/parlays/route.ts').includes('v48-recommendation-quality-1')&&read('scripts/validate-cloudflare-build.mjs').includes('v48-recommendation-quality-1'),'built Worker must contain V48 parlay schema marker');

const requiredCrons=[
 '/api/cron/heartbeat','/api/cron/settle','/api/cron/scan','/api/cron/decision','/api/cron/recalibrate'
];
const cronPaths=new Set((vercel.crons||[]).map(x=>x.path));
for(const cron of requiredCrons)add(`cron ${cron}`,cronPaths.has(cron),cron);

for(const token of [
 'Content-Security-Policy','Strict-Transport-Security','X-Frame-Options',
 'MAX_MUTATION_BYTES','WRITE_API_RATE_LIMIT','READ_API_RATE_LIMIT'
])add(`security policy ${token}`,security.includes(token)||proxy.includes(token),token);
add('mutation body limit enforced',proxy.includes('content-length')&&proxy.includes('MAX_MUTATION_BYTES'),'proxy content-length gate');
add('dangerous methods blocked',proxy.includes("'TRACE'")&&proxy.includes("'TRACK'")&&proxy.includes("'CONNECT'"),'TRACE/TRACK/CONNECT');

const previewWorkflow=read('.github/workflows/deploy-preview.yml');
const candidateWorkflow=read('.github/workflows/release-candidate.yml');
const productionWorkflow=read('.github/workflows/deploy-production.yml');
add('preview workflow release audit',previewWorkflow.includes('npm run release-audit'),'release audit required');
add('candidate workflow release audit',candidateWorkflow.includes('npm run release-audit'),'release audit required');
add('production workflow release audit',productionWorkflow.includes('npm run release-audit'),'release audit required');
add('direct preview promotion disabled',!candidateWorkflow.includes('vercel promote'),'canonical production deploy required');
add('production final certification',productionWorkflow.includes('/api/release/certify?strict=1'),'strict final certification required');
const cloudflareWorkflow=read('.github/workflows/deploy-cloudflare.yml');
add('Cloudflare workflow preflight',cloudflareWorkflow.includes('npm run preflight:cloudflare'),'preflight required');
add('Cloudflare workflow generated config',cloudflareWorkflow.includes('dist/server/wrangler.json'),'generated config required');
add('Cloudflare workflow model identity',cloudflareWorkflow.includes(expected.modelVersion),expected.modelVersion);
add('Cloudflare workflow app identity',cloudflareWorkflow.includes(expected.appVersion),expected.appVersion);
add('Cloudflare workflow verifies live data',cloudflareWorkflow.includes('/api/live-data/status?requireLive=1'),'live sportsbook data required after deploy');
add('Cloudflare workflow current Wrangler',cloudflareWorkflow.includes('wranglerVersion: "4.147.0"'),'Wrangler 4.147.0');
const cloudflareVerifyWorkflow=read('.github/workflows/verify-cloudflare.yml');
add('Cloudflare verify generated config',cloudflareVerifyWorkflow.includes('npm run validate:cloudflare-build'),'generated Worker config validated in CI');

for(const workflow of [
 '.github/workflows/deploy-preview.yml',
 '.github/workflows/deploy-production.yml',
 '.github/workflows/release-candidate.yml',
 '.github/workflows/verify.yml'
]){
 const text=read(workflow);
 add(`${workflow} model identity`,text.includes(expected.modelVersion),expected.modelVersion);
 if(workflow!=='.github/workflows/verify.yml'){
  add(`${workflow} app identity`,text.includes(expected.appVersion),expected.appVersion);
 }
}

const sensitiveKeys=[
 'INGEST_SECRET','CRON_SECRET','DEPLOY_BOOTSTRAP_SECRET','THE_ODDS_API_KEY',
 'ODDS_PROVIDER_PRIMARY_KEY','ODDS_PROVIDER_SECONDARY_KEY','ODDS_PROVIDER_TERTIARY_KEY',
 'WEATHER_PROVIDER_PRIMARY_KEY','INJURY_PROVIDER_PRIMARY_KEY','STATS_PROVIDER_PRIMARY_KEY',
 'RESULTS_PROVIDER_PRIMARY_KEY','PREDICTION_PROVIDER_PRIMARY_KEY'
];
for(const key of sensitiveKeys){
 const match=envExample.match(new RegExp(`^${key}=(.*)$`,'m'));
 add(`.env.example ${key} blank`,!match||match[1].trim()==='',match?'<blank required>':'not present');
}

let tracked=[];
try{
 tracked=execFileSync('git',['ls-files'],{cwd:root,encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
}catch{}
const forbiddenTracked=tracked.filter(p=>{
 const base=path.basename(p);
 return (base==='.env'||base.startsWith('.env.')&&base!=='.env.example'||p.includes('.vercel/.env'))&&!p.endsWith('.env.example');
});
add('no tracked secret env files',forbiddenTracked.length===0,forbiddenTracked.join(', '));

const releaseAuditScript=String(pkg.scripts?.['release-audit']||'');
add('release-audit package script',releaseAuditScript.includes('scripts/release-audit.mjs'),releaseAuditScript);

const failed=checks.filter(x=>!x.ok);
const report={ok:failed.length===0,expected,passed:checks.length-failed.length,failed:failed.length,checks};
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exit(1);
