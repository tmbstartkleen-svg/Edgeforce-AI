import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const expected={
 build:'V72',
 appVersion:'72.0.0',
 packageVersion:'0.72.0',
 modelVersion:'edgeforce-v72',
 migrationVersion:84
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
 'src/lib/productionObservability.ts',
 'src/app/api/operations/observability/route.ts',
 'src/components/ProductionObservabilityPanel.tsx',
 'src/lib/v1ReleaseReadiness.ts',
 'src/app/api/release/v1-readiness/route.ts',
 'src/components/V1ReleaseReadinessPanel.tsx',
 'src/lib/productionLaunch.ts',
 'src/app/api/release/launch-status/route.ts',
 'src/components/ProductionLaunchPanel.tsx',
 'EDGEFORCE_V1_RELEASE.md',
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
 'ml-service/Dockerfile',
 'src/lib/mlServiceHealth.ts',
 'src/lib/mlActivation.ts',
 'src/app/api/intelligence/ml-service/route.ts',
 'src/app/api/ml/activate/route.ts',
 'src/app/api/testing/ml-activation/route.ts',
 'src/components/MlServiceActivationPanel.tsx',
 'render.yaml',
 'src/lib/mlDeploymentAttestation.ts',
 'src/app/api/ml/deploy-attest/route.ts',
 'src/app/api/testing/ml-deployment/route.ts',
 'src/components/MlDeploymentAutomationPanel.tsx',
 'scripts/ml-service-doctor.mjs',
 'scripts/ml-activation-doctor.mjs',
 '.github/workflows/deploy-ml-service.yml',
 'src/lib/mlFirstTournament.ts',
 'src/app/api/intelligence/ml-champions/route.ts',
 'src/app/api/ml/first-tournament/route.ts',
 'src/app/api/testing/ml-first-tournament/route.ts',
 'src/components/FirstChampionTournamentPanel.tsx',
 'scripts/ml-first-tournament-doctor.mjs',
 'src/lib/mlChampionDrift.ts',
 'src/app/api/intelligence/ml-drift/route.ts',
 'src/app/api/ml/drift-monitor/route.ts',
 'src/app/api/testing/ml-champion-drift/route.ts',
 'src/components/ChampionDriftPanel.tsx',
 'src/lib/mlShadowRecovery.ts',
 'src/app/api/intelligence/ml-shadow-recovery/route.ts',
 'src/app/api/ml/shadow-recovery/route.ts',
 'src/app/api/testing/ml-shadow-recovery/route.ts',
 'src/components/ShadowRecoveryPanel.tsx',
 'src/lib/playerFeatureFrames.ts',
 'src/app/api/intelligence/player-frames/route.ts',
 'src/app/api/testing/player-frames/route.ts',
 'src/components/PlayerFeatureFramesPanel.tsx',
 'src/lib/playerCalibration.ts',
 'src/app/api/intelligence/player-calibration/route.ts',
 'src/app/api/testing/player-calibration/route.ts',
 'src/components/PlayerCalibrationPanel.tsx',
 'src/lib/opponentMatchupLearning.ts',
 'src/app/api/intelligence/opponent-matchups/route.ts',
 'src/app/api/testing/opponent-matchups/route.ts',
 'src/components/OpponentMatchupPanel.tsx',
 'src/lib/lineupRoleRedistribution.ts',
 'src/app/api/intelligence/lineup-redistribution/route.ts',
 'src/app/api/testing/lineup-redistribution/route.ts',
 'src/components/LineupRedistributionPanel.tsx',
 'src/lib/startingLineupIntelligence.ts',
 'src/app/api/intelligence/starting-lineups/route.ts',
 'src/app/api/testing/starting-lineups/route.ts',
 'src/components/StartingLineupPanel.tsx',
 'src/lib/scheduleFatigueIntelligence.ts',
 'src/app/api/intelligence/schedule-fatigue/route.ts',
 'src/app/api/testing/schedule-fatigue/route.ts',
 'src/components/ScheduleFatiguePanel.tsx',
 'src/lib/venueWeatherIntelligence.ts',
 'src/app/api/intelligence/venue-conditions/route.ts',
 'src/app/api/testing/venue-conditions/route.ts',
 'src/components/VenueConditionsPanel.tsx',
 'src/lib/marketMovementLearning.ts',
 'src/app/api/intelligence/market-movement-learning/route.ts',
 'src/app/api/testing/market-movement-learning/route.ts',
 'src/components/MarketMovementLearningPanel.tsx',
 'src/lib/crossSportOptimizer.ts',
 'src/app/api/intelligence/cross-sport-optimizer/route.ts',
 'src/app/api/testing/cross-sport-optimizer/route.ts',
 'src/components/CrossSportOptimizerPanel.tsx',
 'src/lib/unifiedIntelligence.ts',
 'src/app/api/intelligence/unified-stack/route.ts',
 'src/app/api/testing/unified-intelligence/route.ts',
 'src/components/UnifiedIntelligencePanel.tsx',
 'src/lib/intelligenceReliability.ts',
 'src/app/api/intelligence/reliability/route.ts',
 'src/app/api/testing/intelligence-reliability/route.ts',
 'src/components/ReliabilitySupervisorPanel.tsx',
 'EDGEFORCE_V72_RELEASE.md',
 'EDGEFORCE_V71_RELEASE.md',
 'src/lib/liveInjuryTracking.ts',
 'src/app/api/cron/injuries/route.ts'
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
add('V64.1 intraday injury tracking',read('src/lib/liveInjuryTracking.ts').includes('refreshLiveInjuryTracking')&&read('src/lib/providers/contextFusion.ts').includes('fetchTrackedInjuryContext')&&read('db/v76.sql').includes('injury_context_snapshots'),'injuries are refreshed and persisted throughout the day');
add('V64.1 injury status normalization',read('src/lib/providers/contextFusion.ts').includes('statusAvailability')&&read('src/lib/providers/contextFusion.ts').includes('questionable'),'text injury statuses become bounded player availability');
add('V64.1 injury simulation coverage',read('src/lib/simulation.ts').includes("feat(m,'injury')")&&read('src/lib/sportOutcomeSimulation.ts').includes("feature(m,'injury')")&&read('src/lib/sportMicroSimulation.ts').includes("feat(m,'injury')")&&read('src/lib/sharedEventState.ts').includes('injuryShock'),'fallback, team, micro, prop and shared-event simulations consume injury context');
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
add('ML service activation migration schema',read('db/v45.sql').includes('ml_service_health_snapshots')&&read('db/v45.sql').includes('ml_service_activation_runs'),'v45 ML service activation audit');
add('ML deployment attestation migration schema',read('db/v46.sql').includes('ml_service_deployment_attestations')&&read('db/v46.sql').includes('git_commit'),'v46 ML deployment attestation registry');
add('first tournament evidence migration schema',read('db/v47.sql').includes('ml_first_tournament_runs')&&read('db/v47.sql').includes('external_ml_champion_history'),'v47 first tournament evidence and champion history');
add('champion drift migration schema',read('db/v48.sql').includes('ml_champion_monitor_runs')&&read('db/v48.sql').includes('ml_champion_monitor_snapshots')&&read('db/v48.sql').includes('quarantine_reason'),'v48 settled champion drift and quarantine registry');
add('shadow recovery migration schema',read('db/v49.sql').includes('external_ml_shadow_challengers')&&read('db/v49.sql').includes('external_ml_shadow_prediction_snapshots')&&read('db/v49.sql').includes('ml_shadow_recovery_snapshots'),'v49 shadow challenger live recovery registry');
add('all-market prediction decision engine',read('src/lib/predictionDecisionSignals.ts').includes('BUY_YES')&&read('src/lib/predictionDecisionSignals.ts').includes('BUY_NO')&&read('src/app/api/prediction-terminal/route.ts').includes('decisionSignals'),'cross-venue buy/no-buy decision signals');
add('hourly prediction signal persistence',read('src/app/api/cron/predictions/route.ts').includes('persistPredictionDecisionSignals'),'Cloudflare hourly collector persists signal history');
add('prediction trader intelligence',read('src/lib/predictionTraderIntelligence.ts').includes('/leaderboard')&&read('src/lib/predictionTraderIntelligence.ts').includes('buildTraderSignals'),'public trader leaderboard and smart-money scoring');
add('prediction market movers',read('src/lib/predictionFlow.ts').includes('marketMovers')&&read('src/app/api/prediction-terminal/route.ts').includes('movers'),'market mover analytics exposed');
add('prediction warehouse persistence',read('src/lib/predictionPersistence.ts').includes('prediction_market_snapshots')&&read('src/app/api/cron/predictions/route.ts').includes('persistPredictionTrades'),'Cloudflare collector persists market and trade history');
add('iPhone prediction PWA',read('src/app/manifest.ts').includes("start_url:'/mobile'")&&read('src/components/MobilePredictionTerminal.tsx').includes('iPhone install'),'installable mobile prediction terminal');
add('shadow league migration schema',read('db/v50.sql').includes('external_ml_shadow_leagues')&&read('db/v50.sql').includes('league_rank')&&read('db/v50.sql').includes('league_winners_ready'),'v50 multi-challenger shadow league registry');
add('V62 player frame migration schema',read('db/v73.sql').includes('player_feature_frames')&&read('db/v73.sql').includes('player_learning_state')&&read('db/v73.sql').includes('player_roster_snapshots'),'v73 player dataframe and roster continuity warehouse');
add('V62 feature-frame enrichment',read('src/lib/playerFeatureFrames.ts').includes('derivePlayerFeatureSignals')&&read('src/lib/providers/contextFusion.ts').includes('enrichMarketsWithPlayerFeatureFrames'),'rolling player dataframe joins live context before modeling');
add('V62 simulation integration',read('src/lib/simulation.ts').includes("feat(m,'playerForm')")&&read('src/lib/simulation.ts').includes("feat(m,'playerVolatility')"),'form, matchup, roster and volatility signals affect Monte Carlo inputs');
add('V62 persistent learning loop',read('src/app/api/cron/scan/route.ts').includes('recordPlayerFeatureFrames')&&read('src/lib/playerWarehouse.ts').includes('player_roster_snapshots'),'cron scan persists player frames and roster snapshots');
add('V62 player intelligence API',read('src/app/api/intelligence/player-frames/route.ts').includes('v62-player-feature-frames-1')&&read('src/app/api/testing/player-frames/route.ts').includes('derivePlayerFeatureSignals'),'player-frame observability and regression endpoints exist');
add('V62 player dataframe dashboard',read('src/components/Dashboard.tsx').includes('PlayerFeatureFramesPanel')&&read('src/components/PlayerFeatureFramesPanel.tsx').includes('V62 PLAYER INTELLIGENCE'),'sim-ready player frames are visible on dashboard');
add('V63 player calibration migration schema',read('db/v74.sql').includes('player_calibration_profiles')&&read('db/v74.sql').includes('player_calibration_runs'),'v74 settled player calibration warehouse');
add('V63 player calibration shrinkage',read('src/lib/playerCalibration.ts').includes('priorWeight=12')&&read('src/lib/playerCalibration.ts').includes('calibrationBias=clamp(rawBias*confidence,-.06,.06)'),'small samples shrink toward the model prior and corrections are bounded');
add('V63 player calibration runtime',read('src/lib/providers/contextFusion.ts').includes('enrichMarketsWithPlayerCalibration')&&read('src/lib/simulation.ts').includes('playerCalibrationBias'),'qualified player calibration feeds simulation');
add('V63 player calibration automation',read('src/app/api/cron/recalibrate/route.ts').includes('rebuildPlayerCalibrationProfiles'),'daily recalibration rebuilds player profiles');
add('V63 player calibration API',read('src/app/api/intelligence/player-calibration/route.ts').includes('v63-player-calibration-1')&&read('src/app/api/testing/player-calibration/route.ts').includes('buildPlayerCalibrationProfile'),'player calibration observability and regression endpoints exist');
add('V63 player calibration dashboard',read('src/components/Dashboard.tsx').includes('PlayerCalibrationPanel')&&read('src/components/PlayerCalibrationPanel.tsx').includes('V63 PLAYER LEARNING'),'settled player learning is visible on dashboard');
add('V64 opponent matchup migration schema',read('db/v75.sql').includes('opponent_matchup_profiles')&&read('db/v75.sql').includes('player_opponent_matchup_profiles')&&read('db/v75.sql').includes('opponent_matchup_runs'),'v75 opponent, positional and exact player matchup learning warehouse');
add('V64 opponent profile builder',read('src/lib/opponentMatchupLearning.ts').includes('buildOpponentMatchupProfiles')&&read('src/lib/opponentMatchupLearning.ts').includes('buildPlayerOpponentProfiles')&&read('src/lib/opponentMatchupLearning.ts').includes('normalizedResidual'),'team and positional tendencies are baseline-adjusted and exact player/opponent profiles are learned');
add('V64 matchup runtime',read('src/lib/providers/contextFusion.ts').includes('enrichMarketsWithOpponentMatchups')&&read('src/lib/simulation.ts').includes('opponentMatchupSignal')&&read('src/lib/simulation.ts').includes('playerVsOpponentSignal'),'team defense, positional strength and exact player/opponent signals feed Monte Carlo without double counting V62 opponent history');
add('V64 matchup automation',read('src/app/api/cron/recalibrate/route.ts').includes('rebuildOpponentMatchupProfiles'),'daily recalibration rebuilds matchup profiles');
add('V64 matchup API',read('src/app/api/intelligence/opponent-matchups/route.ts').includes('v64-opponent-matchup-2')&&read('src/app/api/testing/opponent-matchups/route.ts').includes('buildPlayerOpponentProfiles'),'opponent and exact player matchup observability/regression endpoints exist');
add('V64 matchup dashboard',read('src/components/Dashboard.tsx').includes('OpponentMatchupPanel')&&read('src/components/OpponentMatchupPanel.tsx').includes('V64 MATCHUP LEARNING'),'opponent matchup learning is visible on dashboard');
add('V65 redistribution schema',read('db/v77.sql').includes('lineup_redistribution_profiles')&&read('db/v77.sql').includes('lineup_redistribution_runs'),'v77 lineup redistribution warehouse');
add('V65 redistribution learner',read('src/lib/lineupRoleRedistribution.ts').includes('deriveRedistributionProfiles')&&read('src/lib/lineupRoleRedistribution.ts').includes('withoutRows')&&read('src/app/api/testing/lineup-redistribution/route.ts').includes('statLift>0'),'learns and regression-tests teammate opportunity changes when a role player is absent');
add('V65 live injury activation',read('src/lib/lineupRoleRedistribution.ts').includes('injury_context_snapshots')&&read('src/lib/providers/contextFusion.ts').includes('enrichMarketsWithLineupRedistribution'),'fresh injury snapshots activate learned teammate lifts');
add('V65 simulation integration',read('src/lib/simulation.ts').includes('roleRedistributionConfidence')&&read('src/lib/sportOutcomeSimulation.ts').includes('roleProjectionScale'),'redistribution changes probability and player-prop simulation means');
add('V65 dashboard',read('src/components/Dashboard.tsx').includes('LineupRedistributionPanel')&&read('src/components/LineupRedistributionPanel.tsx').includes('V65 ROLE REDISTRIBUTION'),'injury-driven role shifts are visible');
add('V66 depth chart schema',read('db/v78.sql').includes('depth_chart_profiles')&&read('db/v78.sql').includes('live_lineup_snapshots'),'v78 stores learned depth charts and live lineup observations');
add('V66 starter history ingestion',read('src/lib/playerWarehouse.ts').includes('starter=excluded.starter')&&read('src/lib/playerWarehouse.ts').includes('booleanish'),'historical starter flags are preserved when providers expose them');
add('V66 depth chart learner',read('src/lib/startingLineupIntelligence.ts').includes('deriveDepthChartProfiles')&&read('src/app/api/testing/starting-lineups/route.ts').includes('starter.depthRank===1'),'starter rate, role score and depth order are learned and regression tested');
add('V66 live lineup runtime',read('src/lib/providers/contextFusion.ts').includes('enrichMarketsWithStartingLineups')&&read('src/app/api/cron/scan/route.ts').includes('recordLiveLineupSnapshots'),'live starter context and snapshots feed runtime');
add('V66 lineup simulation integration',read('src/lib/simulation.ts').includes('lineupStarterDelta')&&read('src/lib/startingLineupIntelligence.ts').includes('lineupPromotionScore'),'starter uncertainty and injury-driven promotions affect simulation probability');
add('V66 dashboard',read('src/components/Dashboard.tsx').includes('StartingLineupPanel')&&read('src/components/StartingLineupPanel.tsx').includes('V66 LINEUP INTELLIGENCE'),'lineup and depth-chart intelligence is visible');
add('V67 schedule schema',read('db/v79.sql').includes('schedule_fatigue_snapshots')&&read('db/v79.sql').includes('schedule_fatigue_profiles'),'v79 stores event fatigue snapshots and sport profiles');
add('V67 schedule load engine',read('src/lib/scheduleFatigueIntelligence.ts').includes('backToBack')&&read('src/lib/scheduleFatigueIntelligence.ts').includes('threeInFour')&&read('src/lib/scheduleFatigueIntelligence.ts').includes('fourInSix'),'schedule density and short-rest load are modeled');
add('V67 travel engine',read('src/lib/scheduleFatigueIntelligence.ts').includes('haversineMiles')&&read('src/lib/scheduleFatigueIntelligence.ts').includes('timezoneShiftHours')&&read('src/lib/scheduleFatigueIntelligence.ts').includes('eastward'),'distance, timezone and eastward travel burden are modeled');
add('V67 live schedule context',read('src/lib/providers/publicSportsContext.ts').includes('combineScheduleSignals')&&read('src/lib/providers/publicSportsContext.ts').includes('edgeforce-v67-schedule'),'live team schedules feed V67 context');
add('V67 all-sim integration',read('src/lib/simulation.ts').includes('scheduleCompositeEdge')&&read('src/lib/sportOutcomeSimulation.ts').includes('schedulePlayerScale')&&read('src/lib/sportMicroSimulation.ts').includes('scheduleEdge')&&read('src/lib/sharedEventState.ts').includes('scheduleFatigue'),'fallback, team, prop, micro and shared-event sims consume V67');
add('V67 persistence and rebuild',read('src/app/api/cron/scan/route.ts').includes('recordScheduleFatigueSnapshots')&&read('src/app/api/cron/recalibrate/route.ts').includes('rebuildScheduleFatigueProfiles'),'live snapshots persist and sport profiles rebuild daily');
add('V67 regression and dashboard',read('src/app/api/testing/schedule-fatigue/route.ts').includes('away.backToBack===1')&&read('src/components/Dashboard.tsx').includes('ScheduleFatiguePanel'),'deterministic schedule regression and dashboard visibility are present');
add('V68 venue schema',read('db/v80.sql').includes('venue_condition_snapshots')&&read('db/v80.sql').includes('venue_condition_profiles'),'v80 stores live venue conditions and empirical venue profiles');
add('V68 condition engine',read('src/lib/venueWeatherIntelligence.ts').includes('deriveVenueConditionSignals')&&read('src/lib/venueWeatherIntelligence.ts').includes('temperatureF')&&read('src/lib/venueWeatherIntelligence.ts').includes('windGustMph')&&read('src/lib/venueWeatherIntelligence.ts').includes('elevationFt'),'temperature, wind, precipitation and altitude are modeled');
add('V68 sport-aware effects',read('src/lib/venueWeatherIntelligence.ts').includes("family==='football'")&&read('src/lib/venueWeatherIntelligence.ts').includes("family==='baseball'")&&read('src/lib/venueWeatherIntelligence.ts').includes("family==='soccer'")&&read('src/lib/venueWeatherIntelligence.ts').includes("family==='basketball'"),'playing conditions are sport-specific');
add('V68 live context',read('src/lib/providers/publicSportsContext.ts').includes('edgeforce-v68-venue-conditions')&&read('src/lib/providers/publicSportsContext.ts').includes('relative_humidity_2m')&&read('src/lib/providers/publicSportsContext.ts').includes('apparent_temperature'),'live forecast and venue metadata feed V68');
add('V68 all-sim integration',read('src/lib/simulation.ts').includes('venueAdjustment')&&read('src/lib/sportOutcomeSimulation.ts').includes('venuePlayerScale')&&read('src/lib/sportMicroSimulation.ts').includes('venuePace')&&read('src/lib/sharedEventState.ts').includes('venueTotalScale'),'fallback, team, prop, micro and shared-event sims consume V68');
add('V68 persistence and rebuild',read('src/app/api/cron/scan/route.ts').includes('recordVenueConditionSnapshots')&&read('src/app/api/cron/recalibrate/route.ts').includes('rebuildVenueConditionProfiles'),'live venue snapshots persist and venue profiles rebuild daily');
add('V68 regression and dashboard',read('src/app/api/testing/venue-conditions/route.ts').includes('storm.venueTotalEffect<calm.venueTotalEffect')&&read('src/components/Dashboard.tsx').includes('VenueConditionsPanel'),'deterministic condition regression and dashboard visibility are present');
add('V69 movement schema',read('db/v81.sql').includes('market_movement_snapshots')&&read('db/v81.sql').includes('market_movement_profiles'),'v81 stores canonical line movement and settled CLV profiles');
add('V69 canonical continuity',read('src/lib/marketMovementLearning.ts').includes('canonicalMovementSelection')&&read('src/app/api/testing/market-movement-learning/route.ts').includes("Chiefs -2.5")&&read('src/app/api/testing/market-movement-learning/route.ts').includes("Chiefs -3.5"),'point changes remain one continuous market history');
add('V69 movement signals',read('src/lib/marketMovementLearning.ts').includes('marketSteamSignal')&&read('src/lib/marketMovementLearning.ts').includes('marketReversalSignal')&&read('src/lib/marketMovementLearning.ts').includes('marketMoveVelocity'),'steam, reversal and velocity features are explicit');
add('V69 closing-line learning',read('src/lib/marketMovementLearning.ts').includes('closingSkill')&&read('src/lib/marketMovementLearning.ts').includes('closingBrier')&&read('src/lib/marketMovementLearning.ts').includes('offeredBrier'),'settled offered-vs-close efficiency is learned by sport and market');
add('V69 canonical settlement close',read('src/lib/predictionFeedback.ts').includes('inferCanonicalClosingLine')&&read('src/lib/lineMovement.ts').includes('inferCanonicalClosingLine'),'settlement can recover the true pregame close across line changes');
add('V69 context runtime',read('src/lib/providers/contextFusion.ts').includes('enrichMarketsWithMarketMovement')&&read('src/lib/providers/contextFusion.ts').includes("'market-movement'"),'movement learning enriches markets before trained ML');
add('V69 all-sim integration',read('src/lib/simulation.ts').includes('movementAdjustment')&&read('src/lib/sportOutcomeSimulation.ts').includes('movementPlayerScale')&&read('src/lib/sportMicroSimulation.ts').includes('marketTotalLean')&&read('src/lib/sharedEventState.ts').includes('movementTotalScale'),'fallback, team, prop, micro and shared-event sims consume V69');
add('V69 persistence and rebuild',read('src/app/api/cron/scan/route.ts').includes('recordMarketMovementSnapshots')&&read('src/app/api/cron/recalibrate/route.ts').includes('rebuildMarketMovementProfiles'),'movement snapshots persist and settled profiles rebuild daily');
add('V69 dashboard',read('src/components/Dashboard.tsx').includes('MarketMovementLearningPanel')&&read('src/components/MarketMovementLearningPanel.tsx').includes('V69 MARKET LEARNING'),'movement and closing-line learning are visible');
add('V69 recommendation-time price audit',read('src/lib/persistence.ts').includes('offeredOdds:x.odds')&&read('src/lib/predictionFeedback.ts').includes('featureSnapshot?.offeredOdds'),'CLV uses the actual recommendation-time price');
add('V69 continuous drilldown history',read('src/app/api/market/[id]/lines/route.ts').includes('canonicalMovementSelection')&&read('src/components/MarketDrilldown.tsx').includes("'/lines'+(qs.toString()"),'market drilldown follows the same side across point changes');
add('V70 optimizer schema',read('db/v82.sql').includes('cross_sport_optimizer_profiles')&&read('db/v82.sql').includes('cross_sport_optimizer_runs'),'v82 stores hierarchical optimizer profiles and training runs');
add('V70 chronological optimizer',read('src/lib/crossSportOptimizer.ts').includes('splitRows')&&read('src/lib/crossSportOptimizer.ts').includes('holdoutBrierGain')&&read('src/lib/crossSportOptimizer.ts').includes('stableLog'),'optimizer uses chronological holdout promotion gates');
add('V70 hierarchy and shrinkage',read('src/lib/crossSportOptimizer.ts').includes("scope:'GLOBAL'")&&read('src/lib/crossSportOptimizer.ts').includes("scope:'SPORT'")&&read('src/lib/crossSportOptimizer.ts').includes("scope:'SPORT_MARKET'")&&read('src/lib/crossSportOptimizer.ts').includes('shrink(best,prior'),'global, sport and exact-market profiles shrink toward parent priors');
add('V70 bounded blend',read('src/lib/crossSportOptimizer.ts').includes('for(let sim=40;sim<=100;sim+=5)')&&read('src/lib/crossSportOptimizer.ts').includes('for(let market=0;market<=25;market+=5)'),'simulation stays >=40% and direct market weight <=25% in candidate search');
add('V70 safe fallback',read('src/lib/crossSportOptimizer.ts').includes('SAFE_BASELINE')&&read('src/lib/crossSportOptimizer.ts').includes('if(!profile||!profile.promoted)'),'unpromoted groups preserve simulation-first behavior');
add('V70 runtime calibration',read('src/lib/regimeConfidence.ts').includes('applyOptimizerBlend')&&read('src/lib/scanner.ts').includes("calibrationProfileKey(r.sport,'*')")&&read('src/lib/scanner.ts').includes("calibrationProfileKey('*','*')"),'promoted exact, sport and global optimizer profiles feed final probability calibration');
add('V70 consensus de-duplication',read('src/lib/regimeConfidence.ts').includes('optimizerMarketWeight')&&read('src/lib/regimeConfidence.ts').includes('consensusBlendBase*(1-optimizerMarketWeight*.70)'),'existing consensus blend is attenuated when optimizer already uses market weight');
add('V70 optimizer audit trail',read('src/lib/scanner.ts').includes('optimizerBlend:calibrated.optimizerBlend')&&read('src/lib/persistence.ts').includes('optimizerBlend:x.optimizerBlend'),'each recommendation persists the applied optimizer blend');
add('V70 daily retraining',read('src/app/api/cron/recalibrate/route.ts').includes('rebuildCrossSportOptimizerProfiles'),'daily recalibration rebuilds cross-sport optimizer profiles');
add('V70 regression and dashboard',read('src/app/api/testing/cross-sport-optimizer/route.ts').includes('buildCrossSportOptimizerProfiles')&&read('src/components/Dashboard.tsx').includes('CrossSportOptimizerPanel'),'deterministic optimizer regression and dashboard visibility are present');
add('V71 unified schema',read('db/v83.sql').includes('intelligence_stack_certifications'),'v83 stores unified intelligence certification snapshots');
add('V71 market intelligence gate',read('src/lib/unifiedIntelligence.ts').includes('assessMarketIntelligence')&&read('src/lib/scanner.ts').includes('intelligenceStakeScale')&&read('src/lib/scanner.ts').includes('intelligenceStackReady'),'thin intelligence can only reduce recommendation confidence and stake');
add('V71 context integration',read('src/lib/providers/contextFusion.ts').includes('enrichMarketsWithUnifiedIntelligence')&&read('src/lib/providers/contextFusion.ts').includes('unifiedIntelligence:unified.diagnostics'),'unified scoring closes the context enrichment stack');
add('V71 system certification',read('src/lib/unifiedIntelligence.ts').includes('buildUnifiedIntelligenceCertification')&&read('src/lib/productionCertification.ts').includes('unifiedIntelligence.state'),'production certification consumes unified intelligence health');
add('V71 injury automation monitoring',read('src/lib/automationHealth.ts').includes("jobName:'injuries'")&&read('src/lib/automationHealth.ts').includes('maxGapHours:1'),'15-minute injury refresh is monitored as a required automation');
add('V71 daily certification',read('src/app/api/cron/recalibrate/route.ts').includes('persistUnifiedIntelligenceCertification'),'daily recalibration persists unified intelligence certification');
add('V71 release milestone',read('db/v83.sql').includes('intelligence_stack_certifications')&&read('EDGEFORCE_V71_RELEASE.md').includes('V71'),'V71 unified intelligence milestone remains preserved');
add('V71 regression and dashboard',read('src/app/api/testing/unified-intelligence/route.ts').includes('healthy.ready')&&read('src/components/Dashboard.tsx').includes('UnifiedIntelligencePanel'),'unified intelligence regression and dashboard visibility are present');
add('V71 deployment handoff',read('EDGEFORCE_V71_RELEASE.md').includes('final bundle')&&read('src/lib/unifiedIntelligence.ts').includes('edgeforce-v71-unified'),'V71 unified runtime handoff remains documented');
add('V71 final release note',read('EDGEFORCE_V71_RELEASE.md').includes('final bundle')&&read('EDGEFORCE_V71_RELEASE.md').includes('fail-soft'),'final intelligence program handoff is documented');
add('V72 reliability schema',read('db/v84.sql').includes('intelligence_reliability_state')&&read('db/v84.sql').includes('intelligence_reliability_events')&&read('db/v84.sql').includes('intelligence_reliability_runs'),'v84 stores circuit state, transitions and supervisor runs');
add('V72 circuit transition logic',read('src/lib/intelligenceReliability.ts').includes('nextCircuitTransition')&&read('src/lib/intelligenceReliability.ts').includes("circuitState:'HALF_OPEN'")&&read('src/lib/intelligenceReliability.ts').includes('two consecutive recovery checks'),'reliability circuits confirm failures and recoveries');
add('V72 optional isolation',read('src/lib/providers/contextFusion.ts').includes("reliabilityOpen(reliability,'player-calibration')")&&read('src/lib/intelligenceReliability.ts').includes("open.has('schedule')")&&read('src/lib/regimeConfidence.ts').includes('optimizerAvailable'),'open optional layers are removed from context and optimizer runtime influence');
add('V72 protective recommendation brake',read('src/lib/scanner.ts').includes("reliabilityMode==='PROTECTIVE'")&&read('src/lib/scanner.ts').includes("grade='PASS'")&&read('src/lib/scanner.ts').includes('reliabilityStakeScale'),'protective mode makes recommendations non-actionable');
add('V72 incident auto-recovery',read('src/lib/intelligenceReliability.ts').includes('INTELLIGENCE_CIRCUIT_OPEN')&&read('src/lib/intelligenceReliability.ts').includes('autoRecovered'),'circuit incidents are created and automatically resolved after recovery');
add('V72 automation supervisor',read('src/app/api/cron/scan/route.ts').includes('runIntelligenceReliabilitySupervisor')&&read('src/app/api/cron/recalibrate/route.ts').includes('runIntelligenceReliabilitySupervisor'),'scan and recalibration loops refresh reliability state');
add('V72 production certification',read('src/lib/productionCertification.ts').includes("reliability.mode==='PROTECTIVE'")&&read('src/lib/productionObservability.ts').includes('reliability-mode'),'certification and observability consume reliability state');
add('V72 release identity',read('src/lib/releaseManifest.ts').includes("build:'V72'")&&read('src/lib/releaseManifest.ts').includes("modelVersion:'edgeforce-v72'")&&read('src/lib/releaseManifest.ts').includes('migrationVersion:84'),'V72 release identity is synchronized');
add('V72 deployment identity',read('.github/workflows/verify.yml').includes('MODEL_VERSION=edgeforce-v72')&&read('.github/workflows/deploy-production.yml').includes('MODEL_VERSION=edgeforce-v72')&&read('.github/workflows/deploy-cloudflare.yml').includes('72.0.0'),'verification and production workflows target V72');
add('V72 regression and dashboard',read('src/app/api/testing/intelligence-reliability/route.ts').includes("second.circuitState==='OPEN'")&&read('src/components/Dashboard.tsx').includes('ReliabilitySupervisorPanel'),'deterministic circuit regression and dashboard visibility are present');
add('V61 multi-challenger seeding',read('src/lib/externalMlTournament.ts').includes('startShadowLeague')&&read('src/lib/externalMlTournament.ts').includes('ML_SHADOW_LEAGUE_SIZE'),'post-quarantine tournaments seed multiple live challengers');
add('V61 concurrent shadow scoring',read('src/lib/mlShadowRecovery.ts').includes('const competitors=exact.get')&&read('src/lib/mlShadowRecovery.ts').includes('for(const shadow of competitors)'),'every active challenger receives the same live market slate');
add('V61 league scoring',read('src/lib/mlShadowRecovery.ts').includes('shadowLeagueScore')&&read('src/lib/mlShadowRecovery.ts').includes('shadowLeagueWinnerDecision'),'live challenger ranking and winner decision are explicit');
add('V61 winner margin gate',read('src/lib/mlShadowRecovery.ts').includes('ML_SHADOW_LEAGUE_MIN_SCORE_MARGIN')&&read('src/lib/mlShadowRecovery.ts').includes('below required'),'close live races cannot auto-promote');
add('V61 minimum competitors',read('src/lib/mlShadowRecovery.ts').includes('ML_SHADOW_LEAGUE_MIN_COMPETITORS')&&read('src/lib/mlShadowRecovery.ts').includes('live-qualified league competitors'),'single challenger cannot win a multi-model recovery league');
add('V61 winner-only promotion',read('src/lib/mlShadowRecovery.ts').includes("recovery:'V61_MULTI_CHALLENGER_SHADOW_LEAGUE'")&&read('src/lib/mlShadowRecovery.ts').includes("row.state='LEAGUE_LOST'"),'only the live league winner can return to production');
add('V61 production certification',read('src/lib/productionCertification.ts').includes('shadowRecoveryStatus')&&read('src/lib/productionCertification.ts').includes('external ML shadow league'),'production certification consumes live league state');
add('V61 shadow league regression',read('src/app/api/testing/ml-shadow-recovery/route.ts').includes('clearLeagueWinnerPromotes')&&read('src/app/api/testing/ml-shadow-recovery/route.ts').includes('closeLeagueRaceHolds')&&read('src/app/api/testing/ml-shadow-recovery/route.ts').includes('minimumCompetitorsRequired'),'league promotion gates are regression tested');
add('V60 shadow prediction endpoint',read('ml-service/app.py').includes('@app.post("/shadow-predict")')&&read('ml-service/app.py').includes('edgeforce-ml-shadow-predict-result-v1'),'hosted service can score exact challenger artifacts without champion manifests');
add('V60 shadow tournament routing',read('src/lib/externalMlTournament.ts').includes('startShadowLeague')&&read('src/lib/externalMlTournament.ts').includes('Post-quarantine slot requires V61 multi-challenger live shadow league'),'quarantined slots cannot return through holdout-only promotion');
add('V60 zero-weight shadow collection',read('src/app/api/cron/scan/route.ts').includes('recordShadowChallengerPredictions')&&read('src/lib/mlShadowRecovery.ts').includes('productionWeight:0'),'shadow predictions are collected without entering production votes');
add('V60 native-only benchmark',read('src/lib/mlShadowRecovery.ts').includes('delete features.externalExpertProbability')&&read('src/lib/mlShadowRecovery.ts').includes('modelCouncil(nativeMarket).ensemble'),'shadow recovery compares against native-only EdgeForce Council');
add('V60 dual baseline recovery',read('src/lib/mlShadowRecovery.ts').includes('marketBrierSkillScore')&&read('src/lib/mlShadowRecovery.ts').includes('nativeBrierSkillScore'),'recovery must beat sportsbook and native baselines');
add('V60 fresh confirmation',read('src/lib/mlShadowRecovery.ts').includes('priorConfirmations')&&read('src/lib/mlShadowRecovery.ts').includes("state:'RECOVERY_READY'")&&read('src/lib/mlShadowRecovery.ts').includes('sample>=ceiling'),'promotion requires repeated passing evidence with a larger settled sample');
add('V60 shadow rejection',read('src/lib/mlShadowRecovery.ts').includes("state:'REJECTED'")&&read('src/lib/mlShadowRecovery.ts').includes("action:'REJECT'"),'bad live challengers are retired from shadow evaluation');
add('V60 shadow settlement',read('src/lib/resultProvider.ts').includes('settleShadowPredictionFeedback'),'results settlement grades shadow challengers');
add('V60 recovery sequencing',read('src/app/api/cron/recalibrate/route.ts').indexOf('const shadowRecovery=await runShadowRecovery')<read('src/app/api/cron/recalibrate/route.ts').indexOf('const externalMlTournament=await runExternalMlTournament'),'shadow recovery is evaluated before the next tournament');
add('V60 artifact-gated recovery',read('src/lib/mlShadowRecovery.ts').includes("schemaVersion:'edgeforce-ml-promote-v1'")&&read('ml-service/app.py').includes('model artifact not found'),'live-qualified recovery still requires hosted artifact promotion');
add('V60 shadow API',read('src/app/api/intelligence/ml-shadow-recovery/route.ts').includes('v61-shadow-league-1')&&read('src/app/api/ml/shadow-recovery/route.ts').includes('runShadowRecovery'),'shadow recovery status and authenticated runner exist');
add('V60 shadow regression',read('src/app/api/testing/ml-shadow-recovery/route.ts').includes('repeatedFreshPassPromotes')&&read('src/app/api/testing/ml-shadow-recovery/route.ts').includes('badShadowRejected'),'shadow recovery decisions are regression tested');
add('V60 shadow dashboard',read('src/components/Dashboard.tsx').includes('ShadowRecoveryPanel')&&read('src/components/ShadowRecoveryPanel.tsx').includes('V61 MULTI-CHALLENGER SHADOW LEAGUE'),'shadow recovery is visible');
add('V59 champion live settlement',read('src/lib/resultProvider.ts').includes('settleExternalMlPredictionFeedback')&&read('src/lib/mlChampionDrift.ts').includes('update external_ml_prediction_snapshots'),'settled outcomes feed external champion evidence');
add('V59 market baseline snapshots',read('src/lib/externalMlTournament.ts').includes('market_baseline_probability')&&read('db/v48.sql').includes('market_baseline_probability'),'live champion predictions preserve market baseline');
add('V59 drift metrics',read('src/lib/mlChampionDrift.ts').includes('championLiveMetrics')&&read('src/lib/mlChampionDrift.ts').includes('liveBrierSkillScore')&&read('src/lib/mlChampionDrift.ts').includes('liveCalibrationError'),'Brier, log loss, calibration and market-relative skill are measured');
add('V59 two-strike quarantine',read('src/lib/mlChampionDrift.ts').includes('previousCriticalRuns')&&read('src/lib/mlChampionDrift.ts').includes("action:'QUARANTINE'")&&read('src/lib/mlChampionDrift.ts').includes('sampleSize>=ceiling'),'quarantine requires repeated critical drift with new settled evidence');
add('V59 hosted retirement',read('ml-service/app.py').includes('@app.post("/retire")')&&read('ml-service/app.py').includes('champion model changed before retirement'),'service retires only the exact active champion');
add('V59 service-first quarantine',read('src/lib/mlChampionDrift.ts').includes('retireHostedChampion')&&read('src/lib/mlChampionDrift.ts').includes("status='QUARANTINED'"),'hosted manifest is retired before database champion is disabled');
add('V59 native fallback',read('src/lib/mlChampionDrift.ts').includes('native-model fallback')&&read('src/lib/externalMlTournament.ts').includes("active=true and status='ACTIVE'"),'quarantined external champion is excluded from production inference registry');
add('V59 quarantine cooldown',read('src/lib/externalMlTournament.ts').includes('quarantinePromotionBlock')&&read('src/lib/externalMlTournament.ts').includes('ML_CHAMPION_QUARANTINE_COOLDOWN_HOURS'),'quarantined slots cannot immediately re-promote on the same evidence');
add('V59 safe re-promotion',read('src/lib/externalMlTournament.ts').includes("active=true,status='ACTIVE',quarantined_at=null,quarantine_reason=null"),'future evidence-backed tournament promotion can reactivate a champion slot');
add('V59 serialized governance',read('src/app/api/cron/recalibrate/route.ts').indexOf('const championDrift=await runChampionDriftMonitor')<read('src/app/api/cron/recalibrate/route.ts').indexOf('const externalMlTournament=await runExternalMlTournament'),'drift quarantine runs before new tournament promotion');
add('V59 drift API',read('src/app/api/intelligence/ml-drift/route.ts').includes('v59-ml-champion-drift-1')&&read('src/app/api/ml/drift-monitor/route.ts').includes('runChampionDriftMonitor'),'drift status and authenticated monitor APIs exist');
add('V59 drift regression',read('src/app/api/testing/ml-champion-drift/route.ts').includes('repeatedCriticalQuarantines')&&read('src/app/api/testing/ml-champion-drift/route.ts').includes('watchDoesNotQuarantine'),'drift decision states are guarded by CI');
add('V59 certification drift visibility',read('src/lib/productionCertification.ts').includes('championDriftStatus')&&read('src/lib/productionCertification.ts').includes('reverted to native fallback'),'production certification reports external champion drift state');
add('V59 drift dashboard',read('src/components/Dashboard.tsx').includes('ChampionDriftPanel')&&read('src/components/ChampionDriftPanel.tsx').includes('V61 CHAMPION DRIFT + AUTO-ROLLBACK'),'live champion governance is visible');
add('V58 hosted champion artifact endpoint',read('ml-service/app.py').includes('@app.get("/champions")')&&read('ml-service/app.py').includes('artifactExists')&&read('ml-service/app.py').includes('edgeforce-ml-champions-v1'),'hosted service exposes persisted champion manifests and artifact presence');
add('V58 first tournament engine',read('src/lib/mlFirstTournament.ts').includes('runFirstChampionTournament')&&read('src/lib/mlFirstTournament.ts').includes('buildFirstTournamentLeaderboard'),'first tournament orchestration and ranking are implemented');
add('V58 artifact verification gate',read('src/lib/mlFirstTournament.ts').includes('ARTIFACT_MISMATCH')&&read('src/lib/mlFirstTournament.ts').includes('verifyHostedChampionArtifacts'),'database champion must match hosted persistent artifact');
add('V58 champion history',read('src/lib/mlFirstTournament.ts').includes('external_ml_champion_history')&&read('db/v47.sql').includes('external_ml_champion_history'),'promotion/replacement history is durable');
add('V58 first tournament API',read('src/app/api/ml/first-tournament/route.ts').includes('runFirstChampionTournament')&&read('src/app/api/intelligence/ml-champions/route.ts').includes('firstChampionTournamentStatus'),'launch and intelligence APIs exist');
add('V58 first tournament regression',read('src/app/api/testing/ml-first-tournament/route.ts').includes('blocksMissingArtifact')&&read('src/app/api/testing/ml-first-tournament/route.ts').includes('awaitsChampion'),'ranking and fail-closed evidence states are tested');
add('V58 deployment finishes in first tournament',read('.github/workflows/deploy-ml-service.yml').includes('ml-first-tournament-doctor.mjs')&&read('scripts/ml-first-tournament-doctor.mjs').includes('/api/ml/first-tournament'),'hosted ML deployment records first-tournament evidence');
add('V58 first tournament dashboard',read('src/components/Dashboard.tsx').includes('FirstChampionTournamentPanel')&&read('src/components/FirstChampionTournamentPanel.tsx').includes('V61 FIRST CHAMPION TOURNAMENT'),'sport-by-sport winners are visible');
add('V57 Render deployment identity',read('ml-service/app.py').includes('edgeforce-ml-service-v61')&&read('ml-service/app.py').includes('RENDER_GIT_COMMIT')&&read('ml-service/app.py').includes('RENDER_SERVICE_ID'),'ML health exposes exact hosted service identity');
add('V57 deployed-service doctor',read('scripts/ml-service-doctor.mjs').includes('EXPECTED_ML_COMMIT')&&read('scripts/ml-service-doctor.mjs').includes('edgeforce-ml-predict-result-v1'),'service doctor verifies exact commit and inference contract');
add('V57 activation doctor',read('scripts/ml-activation-doctor.mjs').includes('READY_AWAITING_EVIDENCE')&&read('scripts/ml-activation-doctor.mjs').includes('ML_ACTIVATION_SECRET'),'post-deploy activation only accepts safe terminal states');
add('V57 Render API deploy',read('.github/workflows/deploy-ml-service.yml').includes('api.render.com/v1/services/$RENDER_SERVICE_ID/deploys')&&read('.github/workflows/deploy-ml-service.yml').includes('RENDER_DEPLOY_HOOK_URL'),'workflow supports exact Render API deploy plus deploy-hook fallback');
add('V57 Vercel ML wiring',read('.github/workflows/deploy-ml-service.yml').includes('vercel env update')&&read('.github/workflows/deploy-production.yml').includes('ML_PREDICTION_SERVICE_URL'),'ML service endpoints and keys are wired into canonical Vercel production deployment');
add('V57 hardened production redispatch',read('.github/workflows/deploy-ml-service.yml').includes('deploy-production.yml/dispatches'),'manual ML deploy reuses hardened production deployment workflow');
add('V57 deployment attestation registry',read('db/v46.sql').includes('ml_service_deployment_attestations')&&read('src/lib/mlDeploymentAttestation.ts').includes('gitCommit'),'deployed service commit and activation state are durable');
add('V57 deployment attestation API',read('src/app/api/ml/deploy-attest/route.ts').includes('recordMlDeploymentAttestation')&&read('src/app/api/testing/ml-deployment/route.ts').includes('activeRequiresChampion'),'attestation endpoint and regression exist');
add('V57 activation secret',read('src/app/api/ml/activate/route.ts').includes('ML_ACTIVATION_SECRET')&&read('.env.example').includes('ML_ACTIVATION_SECRET='),'automation has a dedicated production activation credential');
add('V57 deployment dashboard',read('src/components/Dashboard.tsx').includes('MlDeploymentAutomationPanel')&&read('src/components/MlDeploymentAutomationPanel.tsx').includes('V61 ML DEPLOYMENT AUTOMATION'),'deployment chain is visible in the dashboard');
add('V56 ML service health circuit',read('src/lib/mlServiceHealth.ts').includes('ML_SERVICE_FAILURE_THRESHOLD')&&read('src/lib/mlServiceHealth.ts').includes('circuit open'),'service failures open a bounded circuit');
add('V56 prediction handshake',read('src/lib/mlServiceHealth.ts').includes('edgeforce-ml-predict-v1')&&read('src/lib/mlServiceHealth.ts').includes('edgeforce-ml-predict-result-v1'),'deployed prediction schema is verified before activation');
add('V56 activation state machine',read('src/lib/mlActivation.ts').includes("'UNCONFIGURED'|'UNHEALTHY'|'READY'|'READY_AWAITING_EVIDENCE'|'ACTIVE'")&&read('src/lib/mlActivation.ts').includes('championsActive<1'),'ACTIVE requires verified champion evidence');
add('V56 activation API',read('src/app/api/intelligence/ml-service/route.ts').includes('mlActivationStatus')&&read('src/app/api/ml/activate/route.ts').includes('activateMlService'),'status and authenticated activation endpoints exist');
add('V56 activation regression',read('src/app/api/testing/ml-activation/route.ts').includes('awaitingEvidence')&&read('src/app/api/testing/ml-activation/route.ts').includes('active'),'activation state machine is guarded by CI');
add('V56 activation dashboard',read('src/components/Dashboard.tsx').includes('MlServiceActivationPanel')&&read('src/components/MlServiceActivationPanel.tsx').includes('V61 ML SERVICE ACTIVATION'),'service activation remains visible on dashboard');
add('V56 Render blueprint',read('render.yaml').includes('healthCheckPath: /health')&&read('render.yaml').includes('mountPath: /data/models')&&read('render.yaml').includes('2c-8g'),'Render deployment includes health check, persistent model disk and explicit compute plan');
add('V56 platform port contract',read('ml-service/Dockerfile').includes('${PORT:-10000}'),'container honors hosting platform PORT');
add('V56 inference circuit guard',read('src/lib/expertModelBridge.ts').includes('mlServiceCircuitAllows')&&read('src/lib/expertModelBridge.ts').includes('V56_CIRCUIT_OPEN'),'live external inference falls back when circuit is open');
add('V56 tournament health gate',read('src/lib/externalMlTournament.ts').includes('probeMlService')&&read('src/lib/externalMlTournament.ts').includes("mode:'service-unhealthy'"),'heavyweight tournament requires a healthy service');
add('V56 hourly health probe',read('src/app/api/cron/heartbeat/route.ts').includes('probeMlService'),'hourly heartbeat records ML service health');
add('V55 external ML tournament service',read('ml-service/app.py').includes('XGBClassifier')&&read('ml-service/app.py').includes('LGBMClassifier')&&read('ml-service/app.py').includes('CatBoostClassifier')&&read('ml-service/app.py').includes('PyMCBayesianLogistic'),'heavyweight Python algorithm service is present');
add('V55 explicit service promotion',read('ml-service/app.py').includes('/promote')&&read('src/lib/externalMlTournament.ts').includes('promoteServiceCandidate'),'training cannot silently replace production champion');
add('V55 tournament registry',read('db/v44.sql').includes('external_ml_candidates')&&read('db/v44.sql').includes('external_ml_champions'),'v44 stores candidates and champions');
add('V55 incumbent promotion margin',read('src/lib/externalMlTournament.ts').includes('ML_TOURNAMENT_PROMOTION_MARGIN')&&read('src/lib/externalMlTournament.ts').includes('promotionDecision'),'incumbent is retained until challenger clears margin');
add('V55 batched training',read('src/lib/externalMlTournament.ts').includes('ML_TOURNAMENT_GROUPS_PER_REQUEST'),'heavyweight service requests are bounded');
add('V55 champion inference bridge',read('src/lib/expertModelBridge.ts').includes('edgeforce-ml-predict-v1')&&read('src/lib/expertModelBridge.ts').includes('ML_PREDICTION_SERVICE_URL'),'promoted service champion feeds expert bridge');
add('V55 tournament API',read('src/app/api/intelligence/ml-tournament/route.ts').includes('v55-external-ml-tournament-1')&&read('src/app/api/testing/ml-tournament/route.ts').includes('promotesClearWinner'),'status API and promotion regression are present');
add('V55 tournament dashboard',read('src/components/Dashboard.tsx').includes('ExternalMlTournamentPanel')&&read('src/components/ExternalMlTournamentPanel.tsx').includes('V61 EXTERNAL ML TOURNAMENT'),'tournament remains visible on dashboard');
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
add('V53 expert API',read('src/app/api/intelligence/expert-models/route.ts').includes('v61-expert-models-1')&&read('src/app/api/testing/expert-models/route.ts').includes('councilIntegrated'),'expert endpoint and deterministic regression remain present in V57');
add('V53 expert dashboard',read('src/components/Dashboard.tsx').includes('ExpertModelSuitePanel')&&read('src/components/ExpertModelSuitePanel.tsx').includes('V61 EXPERT MODELING SUITE'),'expert suite remains visible on dashboard');
add('V52 live comeback engine',read('src/lib/liveComeback.ts').includes('BUY_LOW_REVIEW')&&read('src/lib/liveComeback.ts').includes('requiresGameStateConfirmation'),'buy-low scoring requires explicit live game-state confirmation');
add('V52 live comeback API',read('src/app/api/live-comeback/route.ts').includes('v52-live-comeback-1')&&read('src/app/api/testing/live-comeback/route.ts').includes('gameStateGuardrail'),'production endpoint and regression guardrail are present');
add('V124 production launch controller',read('src/components/OperatorCommandCenter.tsx').includes('ProductionLaunchPanel')&&read('src/lib/productionLaunch.ts').includes("'V1_READY','COMPLETE','FAILED','ROLLED_BACK'")&&read('src/app/api/release/launch-status/route.ts').includes('recordProductionLaunchEvent'),'durable production launch ledger is visible and API-backed');
add('V123 v1 readiness',read('src/components/OperatorCommandCenter.tsx').includes('V1ReleaseReadinessPanel')&&read('src/lib/v1ReleaseReadiness.ts').includes("V1Verdict='GO'|'CONDITIONAL'|'NO_GO'")&&read('src/app/api/release/v1-readiness/route.ts').includes('buildV1ReleaseReadiness'),'final v1 readiness verdict is visible, fail-closed, and API-backed');
add('V123 v1 release checklist',read('EDGEFORCE_V1_RELEASE.md').includes('NO_GO')&&read('EDGEFORCE_V1_RELEASE.md').includes('/api/release/v1-readiness?strict=1'),'final operator release procedure is documented');
add('V122 production observability',read('src/components/OperatorCommandCenter.tsx').includes('ProductionObservabilityPanel')&&read('src/lib/productionCertification.ts').includes('observability: production health is CRITICAL'),'production observability is visible and certification-gated');
add('V52 dashboard live comeback',read('src/components/Dashboard.tsx').includes('OperatorCommandCenter')&&read('src/components/OperatorCommandCenter.tsx').includes('LiveComebackPanel')&&read('src/components/LiveComebackPanel.tsx').includes('LIVE COMEBACK / HALFTIME BUY-LOW WATCH'),'live comeback watch is reachable through the main dashboard command center');
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
add('Cloudflare 15-minute injury cron',wrangler.includes('"*/15 * * * *"')&&read('worker/index.ts').includes("/api/cron/injuries"),'intraday injury refresh every 15 minutes');
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
 '/api/cron/injuries','/api/cron/heartbeat','/api/cron/settle','/api/cron/scan','/api/cron/decision','/api/cron/recalibrate'
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
add('V124 production strict v1 readiness',productionWorkflow.includes('/api/release/v1-readiness?strict=1')&&productionWorkflow.includes('V1_READY')&&productionWorkflow.includes('COMPLETE'),'production cannot complete before V123 strict readiness passes');
add('V124 launch rollback evidence',productionWorkflow.includes('FAILED')&&productionWorkflow.includes('ROLLED_BACK')&&productionWorkflow.includes('/rollback/$PREVIOUS_DEPLOYMENT_ID'),'failed production launches are recorded and rolled back through the Vercel REST API');
add('V124.3 protected deployment team scope',productionWorkflow.includes('VERCEL_SCOPE: tmbstartkleen-4716s-projects')&&productionWorkflow.includes('vercel --token="$VERCEL_TOKEN" --scope="$VERCEL_SCOPE" curl')&&productionWorkflow.includes('SMOKE_VERCEL_AUTH')&&read('scripts/remote-smoke.mjs').includes("['--token',process.env.VERCEL_TOKEN||'','--scope',process.env.VERCEL_SCOPE||'','curl',url]"),'hosted checks use Vercel auth and explicit team scope before the curl subcommand');
add('V124.4 rollback deployment id',productionWorkflow.includes('PREVIOUS_DEPLOYMENT_ID')&&productionWorkflow.includes('/rollback/$PREVIOUS_DEPLOYMENT_ID')&&productionWorkflow.includes('teamId=$VERCEL_ORG_ID'),'rollback targets the captured prior deployment ID through the team-scoped REST API');
add('V124.5 canonical Vercel project target',productionWorkflow.includes('VERCEL_PROJECT_ID: prj_CJokQ1ngz20Rwb7eNjk9gf3HjFHo')&&!productionWorkflow.includes('prj_8edFTZzS8e6RZyMVm1mjxuGJnLPZ'),'production deploy targets the authenticated Edgeforce Vercel project identified by the team CLI');
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
