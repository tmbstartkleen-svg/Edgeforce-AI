import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const expected={
 build:'V55',
 appVersion:'55.0.0',
 packageVersion:'0.55.0',
 modelVersion:'edgeforce-v55',
 migrationVersion:44
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
 'src/app/api/testing/recommendation-quality/route.ts',
 'src/lib/contextQuality.ts',
 'src/app/api/testing/context-quality/route.ts',
 'src/app/api/intelligence/context/route.ts',
 'src/lib/providers/publicSportsContext.ts',
 'src/app/api/testing/public-context-network/route.ts',
 'src/lib/validationLab.ts',
 'src/app/api/intelligence/validation-lab/route.ts',
 'src/app/api/testing/validation-lab/route.ts',
 'src/app/api/testing/prediction-intelligence/route.ts',
 'src/app/api/cron/predictions/route.ts',
 'src/app/api/prediction-terminal/route.ts',
 'src/app/mobile/page.tsx',
 'src/app/manifest.ts',
 'src/components/MobilePredictionTerminal.tsx',
 'src/lib/predictionCategories.ts',
 'src/lib/predictionPersistence.ts',
 'src/lib/predictionTraderIntelligence.ts',
 'src/lib/predictionDecisionSignals.ts',
 'src/lib/liveComeback.ts',
 'src/app/api/live-comeback/route.ts',
 'src/app/api/testing/live-comeback/route.ts',
 'src/components/LiveComebackPanel.tsx',
 'src/lib/expertModelSuite.ts',
 'src/lib/expertModelBridge.ts',
 'src/lib/expertDataBridge.ts',
 'src/app/api/intelligence/expert-models/route.ts',
 'src/app/api/testing/expert-models/route.ts',
 'src/components/ExpertModelSuitePanel.tsx',
 'src/app/models/page.tsx',
 'src/lib/trainedSportModels.ts',
 'src/app/api/intelligence/trained-models/route.ts',
 'src/app/api/ml/train/route.ts',
 'src/app/api/testing/trained-models/route.ts',
 'src/components/TrainedSportModelsPanel.tsx',
 'src/lib/externalMlTournament.ts',
 'src/app/api/intelligence/ml-tournament/route.ts',
 'src/app/api/ml/tournament/route.ts',
 'src/app/api/testing/ml-tournament/route.ts',
 'src/components/ExternalMlTournamentPanel.tsx',
 'ml-service/app.py',
 'ml-service/requirements.txt',
 'ml-service/Dockerfile'
];
for(const file of requiredFiles)add(`required file ${file}`,exists(file),file);
add('native real odds adapter',read('src/lib/providers/config.ts').includes('THE_ODDS_API_KEY')&&read('src/lib/providers/http.ts').includes('the-odds-api://live-board'),'The Odds API wired into provider system');
add('budget-safe odds bootstrap',read('src/lib/providers/theOddsApi.ts').includes("/sports/upcoming/odds")&&!read('src/lib/providers/theOddsApi.ts').includes('mapBatches('),'single upcoming odds request avoids all-sports event fan-out');
add('adaptive full-slate policy',read('src/lib/providers/theOddsApi.ts').includes('adaptiveOddsPolicy')&&read('src/lib/providers/oddsRefreshPolicy.ts').includes("mode:'BOOTSTRAP_ONLY'|'CONSERVE'|'BALANCED'|'EXPANDED'"),'quota-aware sport expansion is active');
add('live parlay API',read('src/app/api/parlays/route.ts').includes('ingestOdds()')&&!read('src/app/api/parlays/route.ts').includes('demoMarkets'),'parlay generation uses production ingestion');
add('transparent parlay fallback',read('src/lib/parlays.ts').includes('WATCH_FALLBACK')&&read('src/app/api/parlays/route.ts').includes('gradeCounts'),'parlay fallback is labeled and diagnosed');
add('recommendation quality tiers',read('src/lib/parlays.ts').includes("'RECOMMENDED'|'VALUE_WATCHLIST'|'HAIL_MARY'|'REJECTED'")&&read('src/app/api/parlays/route.ts').includes('valueWatchlist')&&read('src/app/api/parlays/route.ts').includes('hailMary'),'recommended, watchlist, longshot and rejected tiers are explicit');
add('recommendation risk gates',read('src/lib/parlays.ts').includes('recommendedMinContextCoverage')&&read('src/lib/parlays.ts').includes('MODEL_SIM_DIVERGENCE')&&read('src/lib/parlays.ts').includes('NEGATIVE_EXPECTED_VALUE'),'context, divergence and EV gates protect recommendations');
add('sport-aware context quality',read('src/lib/contextQuality.ts').includes('contextRequirements')&&read('src/lib/contextQuality.ts').includes('recommendationReady'),'sport-specific context completeness is scored');
add('context provider caching',read('src/lib/providers/context.ts').includes('WEATHER_CONTEXT_CACHE_MS')&&read('src/lib/providers/context.ts').includes('INJURY_CONTEXT_CACHE_MS'),'context feeds are cached by capability');
add('context-gated decision paths',read('src/app/api/parlays/route.ts').includes('enrichMarketsWithContext')&&read('src/app/api/cron/decision/route.ts').includes('enrichMarketsWithContext')&&read('src/app/api/cron/scan/route.ts').includes('enrichMarketsWithContext'),'recommendation and automation paths consume context quality');
add('context model audit trail',read('src/lib/persistence.ts').includes('contextQuality:x.contextQuality')&&read('src/lib/persistence.ts').includes('contextProvenance:x.contextProvenance'),'context quality and provenance are persisted with model runs');
add('real public context adapter',read('src/lib/providers/publicSportsContext.ts').includes('site.api.espn.com')&&read('src/lib/providers/publicSportsContext.ts').includes('api.open-meteo.com'),'ESPN event context and Open-Meteo weather are integrated');
add('event-level context matching',read('src/lib/providers/publicSportsContext.ts').includes('matchEspnEvent')&&read('src/lib/providers/publicSportsContext.ts').includes('parseEspnInjuries'),'public context is matched at event/team level');
add('configured context override priority',read('src/lib/providers/contextFusion.ts').includes('Configured providers below are authoritative overrides'),'paid/configured providers override public supplemental context');
add('context provenance',read('src/lib/types.ts').includes('ContextProvenance')&&read('src/lib/contextQuality.ts').includes('contextProvenance'),'field-level context source provenance is modeled');
add('validation laboratory metrics',read('src/lib/validationLab.ts').includes('brierSkillScore')&&read('src/lib/validationLab.ts').includes('walkForwardBrier')&&read('src/lib/validationLab.ts').includes('contextContribution')&&read('src/lib/validationLab.ts').includes('simulationComparison'),'out-of-sample, calibration, context and simulation evidence are measured');
add('validation weight gate',read('src/lib/learnedWeights.ts').includes('loadValidationMultipliers')&&read('src/lib/validationLab.ts').includes('promotionEligible'),'runtime learned weights consume validation evidence');
add('validation scheduled run',read('src/app/api/cron/recalibrate/route.ts').includes('runValidationLab'),'daily recalibration includes prediction validation');
add('validation production certification',read('src/lib/productionCertification.ts').includes('getValidationLabStatus')&&read('src/lib/productionCertification.ts').includes('model validation:'),'production certification consumes validation evidence');
add('settled feature preservation',read('src/lib/predictionFeedback.ts').includes('rawSimProbability')&&read('src/lib/predictionFeedback.ts').includes('featureSnapshot'),'settled outcomes retain context and simulation features for validation');
add('validation migration schema',read('db/v39.sql').includes('validation_runs')&&read('db/v39.sql').includes('validation_snapshots'),'v39 validation tables');
add('prediction intelligence migration schema',read('db/v40.sql').includes('prediction_market_state')&&read('db/v40.sql').includes('prediction_trade_tape')&&read('db/v40.sql').includes('prediction_trader_profiles'),'v40 prediction intelligence warehouse');
add('player intelligence migration schema',read('db/v41.sql').includes('athletes')&&read('db/v41.sql').includes('player_game_stats')&&read('db/v41.sql').includes('player_prop_predictions'),'v41 player intelligence warehouse');
add('prediction signal migration schema',read('db/v42.sql').includes('prediction_signal_snapshots')&&read('db/v42.sql').includes('take_profit_probability'),'v42 durable prediction signals');
add('trained ML migration schema',read('db/v43.sql').includes('trained_model_artifacts')&&read('db/v43.sql').includes('trained_model_prediction_snapshots'),'v43 trained model registry');
add('external ML tournament migration schema',read('db/v44.sql').includes('external_ml_tournament_runs')&&read('db/v44.sql').includes('external_ml_prediction_snapshots'),'v44 external ML tournament registry');
add('all-market prediction decision engine',read('src/lib/predictionDecisionSignals.ts').includes('BUY_YES')&&read('src/lib/predictionDecisionSignals.ts').includes('BUY_NO')&&read('src/app/api/prediction-terminal/route.ts').includes('decisionSignals'),'cross-venue buy/no-buy decision signals');
add('hourly prediction signal persistence',read('src/app/api/cron/predictions/route.ts').includes('persistPredictionDecisionSignals'),'Cloudflare hourly collector persists signal history');
add('prediction trader intelligence',read('src/lib/predictionTraderIntelligence.ts').includes('/leaderboard')&&read('src/lib/predictionTraderIntelligence.ts').includes('buildTraderSignals'),'public trader leaderboard and smart-money scoring');
add('prediction market movers',read('src/lib/predictionFlow.ts').includes('marketMovers')&&read('src/app/api/prediction-terminal/route.ts').includes('movers'),'market mover analytics exposed');
add('prediction warehouse persistence',read('src/lib/predictionPersistence.ts').includes('prediction_market_snapshots')&&read('src/app/api/cron/predictions/route.ts').includes('persistPredictionTrades'),'Cloudflare collector persists market and trade history');
add('iPhone prediction PWA',read('src/app/manifest.ts').includes("start_url:'/mobile'")&&read('src/components/MobilePredictionTerminal.tsx').includes('iPhone install'),'installable mobile prediction terminal');
add('V55 external ML tournament service',read('ml-service/app.py').includes('XGBClassifier')&&read('ml-service/app.py').includes('LGBMClassifier')&&read('ml-service/app.py').includes('CatBoostClassifier')&&read('ml-service/app.py').includes('PyMCBayesianLogistic'),'heavyweight Python algorithm service is present');
add('V55 explicit service promotion',read('ml-service/app.py').includes('/promote')&&read('src/lib/externalMlTournament.ts').includes('promoteServiceCandidate'),'training cannot silently replace production champion');
add('V55 tournament registry',read('db/v44.sql').includes('external_ml_candidates')&&read('db/v44.sql').includes('external_ml_champions'),'v44 stores candidates and champions');
add('V55 incumbent promotion margin',read('src/lib/externalMlTournament.ts').includes('ML_TOURNAMENT_PROMOTION_MARGIN')&&read('src/lib/externalMlTournament.ts').includes('promotionDecision'),'incumbent is retained until challenger clears margin');
add('V55 batched training',read('src/lib/externalMlTournament.ts').includes('ML_TOURNAMENT_GROUPS_PER_REQUEST'),'heavyweight service requests are bounded');
add('V55 champion inference bridge',read('src/lib/expertModelBridge.ts').includes('edgeforce-ml-predict-v1')&&read('src/lib/expertModelBridge.ts').includes('ML_PREDICTION_SERVICE_URL'),'promoted service champion feeds expert bridge');
add('V55 tournament API',read('src/app/api/intelligence/ml-tournament/route.ts').includes('v55-external-ml-tournament-1')&&read('src/app/api/testing/ml-tournament/route.ts').includes('promotesClearWinner'),'status API and promotion regression are present');
add('V55 tournament dashboard',read('src/components/Dashboard.tsx').includes('ExternalMlTournamentPanel')&&read('src/components/ExternalMlTournamentPanel.tsx').includes('V55 EXTERNAL ML TOURNAMENT'),'tournament is visible on dashboard');
add('V55 prediction audit',read('src/app/api/cron/scan/route.ts').includes('recordExternalMlPredictionSnapshots'),'live champion predictions are persisted');
add('V55 isolated scheduled tournament',read('src/app/api/cron/recalibrate/route.ts').includes('runExternalMlTournament().catch'),'external service failure cannot break native recalibration');
add('V54 trained sport ML engine',read('src/lib/trainedSportModels.ts').includes('trainSportArtifact')&&read('src/lib/trainedSportModels.ts').includes('EDGEFORCE_LOGISTIC_L2_CALIBRATED'),'native sport-specific training engine exists');
add('V54 chronological holdout gate',read('src/lib/trainedSportModels.ts').includes("Math.floor(all.length*.70)")&&read('src/lib/trainedSportModels.ts').includes("Math.floor(all.length*.85)")&&read('src/lib/trainedSportModels.ts').includes('marketBaseline'),'train/calibration/holdout split and market baseline gate are enforced');
add('V54 no council feedback leakage',!read('src/lib/trainedSportModels.ts').includes("voteExpertSuite")&&!read('src/lib/trainedSportModels.ts').includes("voteScenario"),'trained model features exclude prior council votes');
add('V54 trained model registry',read('db/v43.sql').includes('trained_model_artifacts')&&read('db/v43.sql').includes('trained_model_runs'),'v43 stores training runs and artifacts');
add('V54 trained model runtime',read('src/lib/providers/contextFusion.ts').includes('enrichMarketsWithTrainedSportModels')&&read('src/lib/expertModelSuite.ts').includes("name:'Trained Sport ML'"),'promoted artifacts enter live expert consensus');
add('V54 scheduled training',read('src/app/api/cron/recalibrate/route.ts').includes('trainAndPersistSportModels'),'daily recalibration trains candidate sport models');
add('V54 trained model API',read('src/app/api/intelligence/trained-models/route.ts').includes('v54-trained-sport-ml-1')&&read('src/app/api/testing/trained-models/route.ts').includes('positiveSkill'),'status API and deterministic regression are present');
add('V54 trained model dashboard',read('src/components/Dashboard.tsx').includes('TrainedSportModelsPanel')&&read('src/components/TrainedSportModelsPanel.tsx').includes('V54 TRAINED SPORT-SPECIFIC ML'),'trained model registry is visible on dashboard');
add('V53 expert modeling suite',read('src/lib/expertModelSuite.ts').includes('Dixon-Coles')&&read('src/lib/expertModelSuite.ts').includes('XGBoost')&&read('src/lib/expertModelSuite.ts').includes('PyMC'),'professional native + external expert model catalog');
add('V53 expert council integration',read('src/lib/modelCouncil.ts').includes("name:'Expert Suite'")&&read('src/lib/modelCouncil.ts').includes('expertConsensus'),'expert ensemble participates in production model council');
add('V53 external ML bridge',read('src/lib/expertModelBridge.ts').includes('EXPERT_MODEL_SERVICE_URL')&&read('src/lib/providers/contextFusion.ts').includes('enrichMarketsWithExternalExpertModels'),'external trained models are fused before scanning');
add('V53 premium data bridge',read('src/lib/expertDataBridge.ts').includes('edgeforce-premium-context-v1')&&read('src/lib/providers/contextFusion.ts').includes('enrichMarketsWithPremiumData'),'licensed premium feeds can enter through normalized vendor adapters');
add('V53 expert API',read('src/app/api/intelligence/expert-models/route.ts').includes('v55-expert-models-1')&&read('src/app/api/testing/expert-models/route.ts').includes('councilIntegrated'),'expert endpoint and deterministic regression remain present in V55');
add('V53 expert dashboard',read('src/components/Dashboard.tsx').includes('ExpertModelSuitePanel')&&read('src/components/ExpertModelSuitePanel.tsx').includes('V55 EXPERT MODELING SUITE'),'expert suite remains visible on dashboard');
add('V52 live comeback engine',read('src/lib/liveComeback.ts').includes('BUY_LOW_REVIEW')&&read('src/lib/liveComeback.ts').includes('requiresGameStateConfirmation'),'buy-low scoring requires explicit live game-state confirmation');
add('V52 live comeback API',read('src/app/api/live-comeback/route.ts').includes('v52-live-comeback-1')&&read('src/app/api/testing/live-comeback/route.ts').includes('gameStateGuardrail'),'production endpoint and regression guardrail are present');
add('V52 dashboard live comeback',read('src/components/Dashboard.tsx').includes('LiveComebackPanel')&&read('src/components/LiveComebackPanel.tsx').includes('LIVE COMEBACK / HALFTIME BUY-LOW WATCH'),'live comeback watch is visible in main dashboard');
add('V51 dashboard validation',read('src/components/Dashboard.tsx').includes('V51 PREDICTION VALIDATION LAB')&&read('src/components/Dashboard.tsx').includes('Brier skill'),'validation evidence is visible in the dashboard');
add('V51 dashboard context',read('src/components/Dashboard.tsx').includes('V51 EVIDENCE-GATED RECOMMENDATIONS')&&read('src/components/Dashboard.tsx').includes('Live context'),'real context coverage remains visible alongside validation evidence');
add('health runtime identity',read('src/app/api/health/route.ts').includes('releaseIdentityMatch')&&read('src/app/api/health/route.ts').includes('Cloudflare-CDN-Cache-Control'),'health exposes runtime/release identity and disables edge caching');
add('persisted odds reuse',read('src/lib/providers/ingest.ts').includes('stored-live-snapshot')&&read('src/app/api/live-data/status/route.ts').includes('forceLive:requireLive'),'normal reads reuse persisted snapshots while explicit live verification bypasses cache');
add('Neon env fallback',read('src/lib/db.ts').includes('POSTGRES_URL'),'runtime DB accepts Neon integration vars');
add('runtime migration bootstrap',read('src/app/api/release/bootstrap/route.ts').includes('runRuntimeMigrations'),'post-deploy migrations run with Vercel runtime secrets');
add('governance migration schema',read('db/v38.sql').includes('model_governance_snapshots')&&read('db/v38.sql').includes('model_governance_runs'),'v38 governance tables');
add('governance runtime brake',read('src/lib/learnedWeights.ts').includes('loadGovernanceMultipliers'),'learned weights consume governance');
add('governance scheduled rebuild',read('src/app/api/cron/recalibrate/route.ts').includes('runModelGovernance'),'recalibration runs governance');
add('Cloudflare runtime platform identity',wrangler.includes('"DEPLOYMENT_PLATFORM": "cloudflare"'),'Cloudflare production platform is explicit');
add('Cloudflare runtime environment identity',wrangler.includes('"DEPLOYMENT_ENV": "production"'),'Cloudflare production environment is explicit');
add('Cloudflare model identity',wrangler.includes(`"MODEL_VERSION": "${expected.modelVersion}"`),expected.modelVersion);
add('Cloudflare account target',wrangler.includes('"account_id": "de9b84b39940a0b5b622ae5d27b415dc"'),'selected Cloudflare account is pinned');
add('Cloudflare custom Worker entry',wrangler.includes('"main": "./worker/index.ts"'),'custom fetch + scheduled entrypoint');
add('Cloudflare hourly autopilot cron',wrangler.includes('"0 * * * *"'),'hourly live-data automation');
add('Cloudflare prediction intelligence cron',read('worker/index.ts').includes("/api/cron/predictions"),'hourly prediction-market history collection runs on Workers');
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
add('parlay route artifact identity',read('src/app/api/parlays/route.ts').includes('v51-prediction-validation-1')&&read('scripts/validate-cloudflare-build.mjs').includes('v51-prediction-validation-1'),'built Worker must contain V51 parlay schema marker');

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
add('Cloudflare workflow verifies prediction intelligence',cloudflareWorkflow.includes('/api/cron/predictions'),'prediction intelligence warehouse is populated after deploy');
add('Cloudflare workflow verifies iPhone PWA',cloudflareWorkflow.includes('/mobile')&&cloudflareWorkflow.includes('/manifest.webmanifest'),'mobile PWA surfaces verified after deploy');
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
