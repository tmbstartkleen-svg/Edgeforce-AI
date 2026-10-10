import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const expected={
 build:'V119',
 appVersion:'119.0.0',
 packageVersion:'0.119.0',
 modelVersion:'edgeforce-v119',
 migrationVersion:118
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
const supervisionSources=[
 read('src/lib/sloGovernor.ts'),
 read('src/lib/preventiveSupervisionCycle.ts'),
 read('src/lib/preventiveBaselineGovernanceCycle.ts')
].join('\n');

add('package version',pkg.version===expected.packageVersion,`${pkg.version} expected ${expected.packageVersion}`);
add('typescript-eslint deterministic pin',pkg.overrides?.['@typescript-eslint/project-service']==='8.71.0'&&pkg.overrides?.['@typescript-eslint/typescript-estree']==='8.71.0','stable 8.71.0 family pin prevents partial-publish CI drift');
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
 'src/lib/deploymentGuard.ts',
 'src/app/api/release/deployment-guard/route.ts',
 'src/app/api/testing/deployment-guard/route.ts',
 'src/components/DeploymentGuardPanel.tsx',
 'EDGEFORCE_V73_RELEASE.md',
 'src/lib/sloGovernor.ts',
 'src/app/api/release/error-budget/route.ts',
 'src/app/api/cron/slo-governor/route.ts',
 'src/app/api/testing/slo-governor/route.ts',
 'src/components/SloGovernorPanel.tsx',
 'EDGEFORCE_V74_RELEASE.md',
 'src/lib/incidentAttribution.ts',
 'src/app/api/operations/incident-attribution/route.ts',
 'src/app/api/testing/incident-attribution/route.ts',
 'src/components/IncidentAttributionPanel.tsx',
 'EDGEFORCE_V75_RELEASE.md',
 'src/lib/incidentPatternLearning.ts',
 'src/app/api/operations/incident-patterns/route.ts',
 'src/app/api/testing/incident-patterns/route.ts',
 'src/components/IncidentPatternLearningPanel.tsx',
 'EDGEFORCE_V76_RELEASE.md',
 'src/lib/predictiveIncidentRisk.ts',
 'src/app/api/operations/predictive-incident-risk/route.ts',
 'src/app/api/testing/predictive-incident-risk/route.ts',
 'src/components/PredictiveIncidentRiskPanel.tsx',
 'EDGEFORCE_V77_RELEASE.md',
 'src/lib/preventiveActionLearning.ts',
 'src/app/api/operations/preventive-actions/route.ts',
 'src/app/api/testing/preventive-actions/route.ts',
 'src/components/PreventiveActionLearningPanel.tsx',
 'EDGEFORCE_V78_RELEASE.md',
 'src/lib/preventiveActionRanking.ts',
 'src/app/api/operations/preventive-action-ranking/route.ts',
 'src/app/api/testing/preventive-action-ranking/route.ts',
 'src/components/PreventiveActionRankingPanel.tsx',
 'EDGEFORCE_V79_RELEASE.md',
 'src/lib/preventiveActionDecisionGate.ts',
 'src/app/api/operations/preventive-action-decision/route.ts',
 'src/app/api/testing/preventive-action-decision/route.ts',
 'src/components/PreventiveActionDecisionPanel.tsx',
 'EDGEFORCE_V80_RELEASE.md',
 'src/lib/preventiveDecisionCalibration.ts',
 'src/app/api/operations/preventive-decision-calibration/route.ts',
 'src/app/api/testing/preventive-decision-calibration/route.ts',
 'src/components/PreventiveDecisionCalibrationPanel.tsx',
 'EDGEFORCE_V81_RELEASE.md',
 'src/lib/preventiveDecisionThresholds.ts',
 'src/app/api/operations/preventive-decision-thresholds/route.ts',
 'src/app/api/testing/preventive-decision-thresholds/route.ts',
 'src/components/PreventiveDecisionThresholdPanel.tsx',
 'EDGEFORCE_V82_RELEASE.md',
 'src/lib/preventiveThresholdStability.ts',
 'src/app/api/operations/preventive-threshold-stability/route.ts',
 'src/app/api/testing/preventive-threshold-stability/route.ts',
 'src/components/PreventiveThresholdStabilityPanel.tsx',
 'EDGEFORCE_V83_RELEASE.md',
 'src/lib/preventiveThresholdRecovery.ts',
 'src/app/api/operations/preventive-threshold-recovery/route.ts',
 'src/app/api/testing/preventive-threshold-recovery/route.ts',
 'src/components/PreventiveThresholdRecoveryPanel.tsx',
 'EDGEFORCE_V84_RELEASE.md',
 'src/lib/preventiveThresholdProbation.ts',
 'src/app/api/operations/preventive-threshold-probation/route.ts',
 'src/app/api/testing/preventive-threshold-probation/route.ts',
 'src/components/PreventiveThresholdProbationPanel.tsx',
 'EDGEFORCE_V85_RELEASE.md',
 'src/lib/preventiveProbationPerformance.ts',
 'src/app/api/operations/preventive-probation-performance/route.ts',
 'src/app/api/testing/preventive-probation-performance/route.ts',
 'src/components/PreventiveProbationPerformancePanel.tsx',
 'EDGEFORCE_V86_RELEASE.md',
 'src/lib/preventiveChampionBaseline.ts',
 'src/app/api/operations/preventive-champion-baseline/route.ts',
 'src/app/api/testing/preventive-champion-baseline/route.ts',
 'src/components/PreventiveChampionBaselinePanel.tsx',
 'EDGEFORCE_V87_RELEASE.md',
 'src/lib/preventiveChampionBaselineHealth.ts',
 'src/app/api/operations/preventive-champion-baseline-health/route.ts',
 'src/app/api/testing/preventive-champion-baseline-health/route.ts',
 'src/components/PreventiveChampionBaselineHealthPanel.tsx',
 'EDGEFORCE_V88_RELEASE.md',
 'src/lib/preventiveBaselineSuccession.ts',
 'src/app/api/operations/preventive-baseline-succession/route.ts',
 'src/app/api/testing/preventive-baseline-succession/route.ts',
 'src/components/PreventiveBaselineSuccessionPanel.tsx',
 'EDGEFORCE_V89_RELEASE.md',
 'src/lib/preventiveBaselineHandoff.ts',
 'src/app/api/operations/preventive-baseline-handoff/route.ts',
 'src/app/api/testing/preventive-baseline-handoff/route.ts',
 'src/components/PreventiveBaselineHandoffPanel.tsx',
 'EDGEFORCE_V90_RELEASE.md',
 'src/lib/preventiveSuccessorValidation.ts',
 'src/app/api/operations/preventive-successor-validation/route.ts',
 'src/app/api/testing/preventive-successor-validation/route.ts',
 'src/components/PreventiveSuccessorValidationPanel.tsx',
 'EDGEFORCE_V91_RELEASE.md',
 'src/lib/preventiveSuccessorGraduation.ts',
 'src/app/api/operations/preventive-successor-graduation/route.ts',
 'src/app/api/testing/preventive-successor-graduation/route.ts',
 'src/components/PreventiveSuccessorGraduationPanel.tsx',
 'EDGEFORCE_V92_RELEASE.md',
 'src/lib/preventiveBaselineConsistency.ts',
 'src/app/api/operations/preventive-baseline-consistency/route.ts',
 'src/app/api/testing/preventive-baseline-consistency/route.ts',
 'src/components/PreventiveBaselineConsistencyPanel.tsx',
 'EDGEFORCE_V93_RELEASE.md',
 'src/lib/preventiveBaselineGovernanceCycle.ts',
 'src/app/api/operations/preventive-baseline-governance-cycle/route.ts',
 'src/app/api/testing/preventive-baseline-governance-cycle/route.ts',
 'src/components/PreventiveBaselineGovernanceCyclePanel.tsx',
 'EDGEFORCE_V94_RELEASE.md',
 'src/lib/preventiveBaselineGovernanceWatchdog.ts',
 'src/app/api/operations/preventive-baseline-governance-watchdog/route.ts',
 'src/app/api/testing/preventive-baseline-governance-watchdog/route.ts',
 'src/components/PreventiveBaselineGovernanceWatchdogPanel.tsx',
 'EDGEFORCE_V95_RELEASE.md',
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
add('V72 release milestone',read('db/v84.sql').includes('intelligence_reliability_state')&&read('EDGEFORCE_V72_RELEASE.md').includes('V72'),'V72 reliability milestone remains preserved');
add('V72 deployment handoff',read('EDGEFORCE_V72_RELEASE.md').includes('circuit breakers')&&read('src/lib/intelligenceReliability.ts').includes('edgeforce-v72-reliability'),'V72 reliability runtime handoff remains documented');
add('V72 regression and dashboard',read('src/app/api/testing/intelligence-reliability/route.ts').includes("second.circuitState==='OPEN'")&&read('src/components/Dashboard.tsx').includes('ReliabilitySupervisorPanel'),'deterministic circuit regression and dashboard visibility are present');
add('V73 deployment guard schema',read('db/v85.sql').includes('deployment_guard_runs')&&read('db/v85.sql').includes('hard_block'),'v85 stores comparative canary decisions and rollback evidence');
add('V73 comparative guard engine',read('src/lib/deploymentGuard.ts').includes('evaluateDeploymentGuard')&&read('src/lib/deploymentGuard.ts').includes('scoreDelta')&&read('src/lib/deploymentGuard.ts').includes('reliabilityDelta'),'candidate health is compared against the production baseline');
add('V73 hard rollback gates',read('src/lib/deploymentGuard.ts').includes("observabilityOverall==='CRITICAL'")&&read('src/lib/deploymentGuard.ts').includes("reliabilityMode==='PROTECTIVE'")&&read('src/lib/deploymentGuard.ts').includes('candidate.certified'),'hard blockers cover certification, readiness, observability and reliability');
add('V73 baseline capture',read('.github/workflows/deploy-production.yml').includes('Capture production baseline')&&read('.github/workflows/deploy-production.yml').includes('DEPLOYMENT_BASELINE_B64'),'deployment captures the previous production health baseline before replacing it');
add('V73 three-probe canary',read('.github/workflows/deploy-production.yml').includes('for ATTEMPT in 1 2 3')&&read('.github/workflows/deploy-production.yml').includes('test "$PASSES" -ge 2'),'candidate must pass two of three comparative probes');
add('V73 canary launch stage',read('src/lib/productionLaunch.ts').includes("'CANARY_PASSED'")&&read('.github/workflows/deploy-production.yml').includes('CANARY_PASSED'),'launch completion requires a successful comparative canary');
add('V73 automatic rollback',read('.github/workflows/deploy-production.yml').includes('rollback/$PREVIOUS_DEPLOYMENT_ID')&&read('.github/workflows/deploy-production.yml').includes('failure() && steps.deploy.outcome == \'success\''),'deployment failure still routes to the captured prior deployment');
add('V73 release milestone',read('db/v85.sql').includes('deployment_guard_runs')&&read('EDGEFORCE_V73_RELEASE.md').includes('V73'),'V73 comparative canary milestone remains preserved');
add('V73 deployment handoff',read('EDGEFORCE_V73_RELEASE.md').includes('Comparative Canary')&&read('src/lib/deploymentGuard.ts').includes('evaluateDeploymentGuard'),'V73 deployment-guard handoff remains documented');
add('V73 regression and dashboard',read('src/app/api/testing/deployment-guard/route.ts').includes("healthy.decision==='PASS'")&&read('src/components/Dashboard.tsx').includes('DeploymentGuardPanel'),'deterministic canary regression and dashboard visibility are present');
add('V73 CLI pin',read('src/lib/releaseManifest.ts').includes("vercelCliVersion:'62.2.0'")&&read('.github/workflows/deploy-production.yml').includes('vercel@62.2.0')&&read('.github/workflows/rollback.yml').includes('vercel@62.2.0'),'production and rollback workflows use the same pinned Vercel CLI');
add('V74 SLO schema',read('db/v86.sql').includes('slo_error_budget_state')&&read('db/v86.sql').includes('slo_error_budget_snapshots')&&read('db/v86.sql').includes('slo_error_budget_events'),'v86 stores deployment freeze state, budget snapshots and transitions');
add('V74 multi-window burn',read('src/lib/sloGovernor.ts').includes("evaluateSloWindow")&&read('src/lib/sloGovernor.ts').includes("'1h'")&&read('src/lib/sloGovernor.ts').includes("'24h'")&&read('src/lib/sloGovernor.ts').includes("'7d'"),'SLO governor evaluates 1h, 24h and 7d windows');
add('V74 freeze thresholds',read('src/lib/sloGovernor.ts').includes('oneHour.burnRate>=8')&&read('src/lib/sloGovernor.ts').includes('twentyFourHour.burnRate>=4')&&read('src/lib/sloGovernor.ts').includes('sevenDay.budgetRemaining<=0'),'fast and slow burn thresholds freeze unsafe deployments');
add('V74 sustained recovery',read('src/lib/sloGovernor.ts').includes('three consecutive safe checks passed')&&read('src/app/api/testing/slo-governor/route.ts').includes("reopened.state==='OPEN'"),'deployment freeze needs three safe recovery checks before reopening');
add('V74 hourly governor automation',read('src/lib/automationHealth.ts').includes("jobName:'slo-governor'")&&read('worker/index.ts').includes('/api/cron/slo-governor')&&!Array.isArray(vercel.crons),'Cloudflare owns scheduled SLO governance while Vercel remains manual-only standby');
add('V74 predeploy freeze',read('.github/workflows/deploy-production.yml').includes('Enforce current production SLO budget')&&read('.github/workflows/deploy-production.yml').includes('deploymentAllowed // false'),'existing production can freeze the next deploy before build');
add('V74 candidate SLO gate',read('.github/workflows/deploy-production.yml').includes('Refresh candidate SLO governor')&&read('.github/workflows/deploy-production.yml').includes('SLO_BUDGET_PASSED'),'candidate must pass the error-budget gate before comparative canary');
add('V74 production certification',read('src/lib/productionCertification.ts').includes("sloGovernor.state==='FROZEN'")&&read('src/lib/v1ReleaseReadiness.ts').includes("'slo-error-budget'"),'production certification and final readiness consume SLO state');
add('V74 release milestone',exists('EDGEFORCE_V74_RELEASE.md')&&exists('db/v86.sql')&&read('src/lib/sloGovernor.ts').includes('SLO'),'V74 SLO governor milestone remains preserved');
add('V74 deployment controls',read('.github/workflows/deploy-production.yml').includes('Enforce current production SLO budget')&&read('.github/workflows/deploy-production.yml').includes('SLO_BUDGET_PASSED')&&read('.github/workflows/deploy-production.yml').includes(expected.modelVersion),'V74 SLO deployment controls remain active under the current release identity');
add('V74 regression and dashboard',read('src/app/api/testing/slo-governor/route.ts').includes('bad.freezeTriggered')&&read('src/components/Dashboard.tsx').includes('SloGovernorPanel'),'SLO freeze/recovery regression and dashboard visibility are present');
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
add('Cloudflare Worker-safe live comeback',!read('src/app/api/live-comeback/route.ts').includes('enrichMarketsWithContext')&&read('src/app/api/live-comeback/route.ts').includes('prepareWorkerSafeLiveComebackMarkets')&&read('src/app/api/live-comeback/route.ts').includes('simulationRunCap:1000')&&read('src/lib/liveComeback.ts').includes('externalContextRequests:0'),'latency-sensitive live comeback avoids unbounded public-context fan-out and high simulation tiers');
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
add('Cloudflare hourly autopilot cron',wrangler.includes('"3,13,23,33,43,53 * * * *"'),'sharded hourly live-data automation');
add('Cloudflare 15-minute injury cron',wrangler.includes('"*/15 * * * *"')&&read('worker/index.ts').includes("/api/cron/injuries"),'intraday injury refresh every 15 minutes');
add('Cloudflare prediction intelligence cron',read('worker/index.ts').includes("/api/cron/predictions"),'hourly prediction-market history collection runs on Workers');
add('Cloudflare daily certification cron',wrangler.includes('"15,45 6 * * *"'),'sharded daily recalibration and provider certification');
add('Cloudflare production demo disabled',wrangler.includes('"ALLOW_DEMO_DATA": "false"'),'production never substitutes demo odds');
add('production ingestion rejects demo fallback',read('src/lib/providers/ingest.ts').includes("source:'unavailable' as const")&&read('src/lib/providers/ingest.ts').includes('ALLOW_DEMO_DATA'),'production unavailable state is explicit');
add('public scan uses live ingestion',read('src/app/api/scan/route.ts').includes("ingestOdds"),'scan is not demo-backed');
add('decision automation uses live ingestion',read('src/app/api/cron/decision/route.ts').includes("ingestOdds")&&!read('src/app/api/cron/decision/route.ts').includes("demoMarkets"),'decision automation is real-data only');
add('live data status endpoint',read('src/app/api/live-data/status/route.ts').includes("connected:ingestion.source==='live'"),'live connection status exposed');
add('shared event-state joint engine',read('src/lib/eventJointSimulation.ts').includes('runSharedEventStateSimulation')&&read('src/lib/sharedEventState.ts').includes("engine:'SHARED_EVENT_STATE'"),'same-game legs share one event scenario');
add('shared event-state regression',read('src/app/api/testing/joint-simulation/route.ts').includes("engine:'SHARED_EVENT_STATE'")&&read('src/lib/eventJointSimulation.ts').includes('runSharedEventStateSimulation'),'CI guards joint engine routing');
add('Cloudflare autopilot Worker',read('worker/index.ts').includes("handler from 'vinext/server/fetch-handler'")&&read('worker/index.ts').includes('scheduled'),'custom Worker delegates HTTP and handles cron');
add('Cloudflare local preflight placeholder guard',read('scripts/cloudflare-preflight.mjs').includes('PASTE_YOUR_ACCOUNT_ID_HERE'),'placeholder account IDs are rejected');
add('Cloudflare generated build validation',read('scripts/validate-cloudflare-build.mjs').includes('dist/server/wrangler.json'),'generated Worker config is validated');
add('Cloudflare deploy script uses generated config',String(pkg.scripts?.['deploy:cloudflare']||'').includes('dist/server/wrangler.json')&&String(pkg.scripts?.['deploy:cloudflare']||'').includes('preflight:cloudflare'),'safe local Cloudflare deploy path');
add('vinext clean build',String(pkg.scripts?.['build:vinext']||'').includes('clean:build')&&read('scripts/clean-build.mjs').includes("['dist','.next','.vinext']"),'stale generated route artifacts are removed before Worker builds');
add('parlay route artifact identity',read('src/app/api/parlays/route.ts').includes('v51-prediction-validation-1')&&read('scripts/validate-cloudflare-build.mjs').includes('v51-prediction-validation-1'),'built Worker must contain V51 parlay schema marker');

const requiredCrons=[
 '/api/cron/injuries','/api/cron/heartbeat','/api/cron/settle','/api/cron/scan','/api/cron/decision','/api/cron/recalibrate'
];
add('Vercel standby has no scheduled crons',!Array.isArray(vercel.crons),'Cloudflare is the sole scheduler; Vercel remains Hobby-safe manual DR');
for(const cron of requiredCrons)add(`Cloudflare cron ${cron}`,read('worker/index.ts').includes(cron),cron);

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
add('V124.3 protected deployment team scope',productionWorkflow.includes('VERCEL_SCOPE: tmbstartkleen-4716s-projects')&&productionWorkflow.includes('vercel curl "')&&productionWorkflow.includes('SMOKE_VERCEL_AUTH')&&read('scripts/remote-smoke.mjs').includes("const args=['curl',url];"),'hosted checks use the linked Vercel project and authenticated CLI environment for protected requests');
add('V124.4 rollback deployment id',productionWorkflow.includes('PREVIOUS_DEPLOYMENT_ID')&&productionWorkflow.includes('/rollback/$PREVIOUS_DEPLOYMENT_ID')&&productionWorkflow.includes('teamId=$VERCEL_ORG_ID'),'rollback targets the captured prior deployment ID through the team-scoped REST API');
add('V124.5 canonical Vercel project target',productionWorkflow.includes('VERCEL_PROJECT_NAME: edgeforce-ai')&&productionWorkflow.includes('Resolve live Vercel project mapping')&&productionWorkflow.includes('.vercel/project.json')&&!productionWorkflow.includes('prj_CJokQ1ngz20Rwb7eNjk9gf3HjFHo'),'production deploy resolves the authenticated Edgeforce Vercel project dynamically instead of trusting a stale committed ID');
const cloudflareWorkflow=read('.github/workflows/deploy-cloudflare.yml');
add('Cloudflare workflow preflight',cloudflareWorkflow.includes('npm run preflight:cloudflare'),'preflight required');
add('Cloudflare workflow generated config',cloudflareWorkflow.includes('dist/server/wrangler.json'),'generated config required');
add('Cloudflare workflow model identity',cloudflareWorkflow.includes(expected.modelVersion),expected.modelVersion);
add('Cloudflare workflow app identity',cloudflareWorkflow.includes(expected.appVersion),expected.appVersion);
add('Cloudflare workflow verifies usable real data',cloudflareWorkflow.includes('/api/live-data/status?requireUsable=1&maxStoredAgeMin=90')||(cloudflareWorkflow.includes('Observe live sportsbook continuity without blocking platform launch')&&cloudflareWorkflow.includes('launch-doctor?strict=1&platform=1')&&read('src/app/api/launch-doctor/route.ts').includes('recommendationReady')),'Cloudflare either requires usable sportsbook data at platform launch or explicitly separates platform health from fail-closed recommendation readiness');
add('Cloudflare workflow verifies prediction intelligence',cloudflareWorkflow.includes('/api/cron/predictions'),'prediction intelligence warehouse is populated after deploy');
add('Cloudflare prediction prime auth',read('src/app/api/cron/predictions/route.ts').includes('process.env.CRON_SECRET,process.env.INGEST_SECRET')&&cloudflareWorkflow.includes('Authorization: Bearer $INGEST_SECRET'),'scheduled prediction collection and manual deployment priming use separate authenticated secret paths');
add('Cloudflare prediction prime convergence retry',cloudflareWorkflow.includes('for ATTEMPT in {1..10}')&&cloudflareWorkflow.includes('prediction-prime route/secret convergence')&&cloudflareWorkflow.includes('[ "$HTTP_CODE" = "401" ]'),'post-deploy prediction priming tolerates bounded Worker secret propagation without weakening the final gate');
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
 'INGEST_SECRET','CRON_SECRET','DEPLOY_BOOTSTRAP_SECRET','THE_ODDS_API_KEY','SPORTS_GAME_ODDS_API_KEY',
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

add('V75 incident attribution engine',read('src/lib/incidentAttribution.ts').includes('attributeOperationalIncident')&&read('src/lib/incidentAttribution.ts').includes("'MARKET_FRESHNESS'")&&read('src/lib/incidentAttribution.ts').includes("'RELIABILITY'"),'root-cause classifier spans production health domains');
add('V75 attribution persistence',read('db/v87.sql').includes('incident_attribution_snapshots')&&read('src/lib/incidentAttribution.ts').includes('persistIncidentAttribution'),'incident evidence is durable');
add('V75 remediation API',read('src/app/api/operations/incident-attribution/route.ts').includes('v75-incident-attribution-1'),'operator API exposes bounded remediation guidance');
add('V75 attribution regression',read('src/app/api/testing/incident-attribution/route.ts').includes('MARKET_FRESHNESS'),'deterministic root-cause regression exists');
add('V75 attribution dashboard',read('src/components/OperatorCommandCenter.tsx').includes('IncidentAttributionPanel')&&read('src/components/IncidentAttributionPanel.tsx').includes('V75 INCIDENT ATTRIBUTION'),'system dashboard exposes incident attribution');

add('V76 incident pattern learning',read('src/lib/incidentPatternLearning.ts').includes('buildIncidentPatternProfiles')&&read('src/lib/incidentPatternLearning.ts').includes('recurrenceScore'),'recurring incident causes are learned from durable V75 history');
add('V76 pattern persistence',read('db/v88.sql').includes('incident_pattern_profiles')&&read('db/v88.sql').includes('incident_pattern_snapshots'),'recurrence profiles and history are durable');
add('V76 co-failure learning',read('src/lib/incidentPatternLearning.ts').includes('cofailureComponents')&&read('src/app/api/testing/incident-patterns/route.ts').includes('injury-feed'),'repeating component co-failures are identified');
add('V76 adaptive runbooks',read('src/lib/incidentPatternLearning.ts').includes('recommendedRunbook')&&read('src/components/IncidentPatternLearningPanel.tsx').includes('Priority runbook'),'cause-specific runbooks are visible to operators');
add('V76 automatic learning cycle',supervisionSources.includes('runIncidentPatternLearning'),'SLO supervision updates incident pattern learning automatically');
add('V76 system dashboard',read('src/components/OperatorCommandCenter.tsx').includes('IncidentPatternLearningPanel'),'incident-pattern learning is visible in the system console');

add('V77 predictive incident risk',read('src/lib/predictiveIncidentRisk.ts').includes('scorePredictiveRisk')&&read('src/lib/predictiveIncidentRisk.ts').includes('riskLevel'),'forward-looking subsystem risk scoring exists');
add('V77 predictive persistence',read('db/v89.sql').includes('predictive_incident_risk_snapshots'),'risk forecasts are durable');
add('V77 preventive warning threshold',read('src/lib/predictiveIncidentRisk.ts').includes('preventiveWarning')&&read('src/lib/predictiveIncidentRisk.ts').includes('>=.70'),'high-risk preventive warning threshold is enforced');
add('V77 predictive regression',read('src/app/api/testing/predictive-incident-risk/route.ts').includes('AUTOMATION')&&read('src/app/api/testing/predictive-incident-risk/route.ts').includes('riskScore>=.70'),'deterministic predictive-risk regression exists');
add('V77 automatic predictive cycle',supervisionSources.includes('runPredictiveIncidentRisk'),'SLO supervision refreshes predictive risk automatically');
add('V77 predictive dashboard',read('src/components/OperatorCommandCenter.tsx').includes('PredictiveIncidentRiskPanel')&&read('src/components/PredictiveIncidentRiskPanel.tsx').includes('V77 PREDICTIVE INCIDENT RISK'),'system console exposes preventive forecast');

add('V78 learning module',read('src/lib/preventiveActionLearning.ts').includes('buildActionEffectivenessProfiles'),'effectiveness learning module exists');
add('V78 durable schema',read('db/v90.sql').includes('preventive_action_effectiveness'),'learning schema exists');
add('V78 API surface',read('src/app/api/operations/preventive-actions/route.ts').includes('v78-preventive-action-learning-1'),'learning API exists');
add('V78 regression surface',read('src/app/api/testing/preventive-actions/route.ts').includes('v78-preventive-action-learning-test-1'),'learning regression exists');
add('V78 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveActionLearningPanel'),'learning panel is visible');

add('V79 ranking module',read('src/lib/preventiveActionRanking.ts').includes('rankPreventiveActions'),'risk-aware safeguard ranking exists');
add('V79 durable ranking',read('db/v91.sql').includes('preventive_action_ranking_snapshots'),'ranking snapshots are durable');
add('V79 ranking API',read('src/app/api/operations/preventive-action-ranking/route.ts').includes('v79-preventive-action-ranking-1'),'ranking API exists');
add('V79 ranking regression',read('src/app/api/testing/preventive-action-ranking/route.ts').includes('STRONG'),'ranking regression covers learned evidence quality');
add('V79 supervision integration',supervisionSources.includes('runPreventiveActionRanking'),'SLO supervision refreshes ranking automatically');
add('V79 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveActionRankingPanel'),'ranking panel is visible');

add('V80 decision gate module',read('src/lib/preventiveActionDecisionGate.ts').includes('evaluatePreventiveActionGate'),'preventive decision gate exists');
add('V80 durable decisions',read('db/v92.sql').includes('preventive_action_decision_snapshots'),'decision snapshots are durable');
add('V80 decision API',read('src/app/api/operations/preventive-action-decision/route.ts').includes('v80-preventive-action-decision-1'),'decision API exists');
add('V80 decision regression',read('src/app/api/testing/preventive-action-decision/route.ts').includes('DO_NOT_USE'),'regression covers recommendation and rejection');
add('V80 supervision integration',supervisionSources.includes('runPreventiveActionDecisionGate'),'SLO supervision refreshes the decision gate');
add('V80 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveActionDecisionPanel'),'decision panel is visible');

add('V81 calibration module',read('src/lib/preventiveDecisionCalibration.ts').includes('buildPreventiveDecisionCalibration'),'decision calibration engine exists');
add('V81 durable calibration',read('db/v93.sql').includes('preventive_decision_calibration_snapshots'),'calibration snapshots are durable');
add('V81 calibration API',read('src/app/api/operations/preventive-decision-calibration/route.ts').includes('v81-preventive-decision-calibration-1'),'calibration API exists');
add('V81 calibration regression',read('src/app/api/testing/preventive-decision-calibration/route.ts').includes('brierScore'),'calibration regression covers Brier and error metrics');
add('V81 supervision integration',supervisionSources.includes('runPreventiveDecisionCalibration'),'SLO supervision refreshes calibration');
add('V81 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveDecisionCalibrationPanel'),'calibration panel is visible');

add('V82 threshold governor',read('src/lib/preventiveDecisionThresholds.ts').includes('derivePreventiveDecisionThresholds'),'adaptive threshold governor exists');
add('V82 hard threshold bounds',read('src/lib/preventiveDecisionThresholds.ts').includes("clamp(recommend,.70,.82)")&&read('src/lib/preventiveDecisionThresholds.ts').includes("clamp(confidence,.42,.60)"),'recommend and confidence thresholds remain bounded');
add('V82 durable thresholds',read('db/v94.sql').includes('preventive_decision_threshold_state')&&read('db/v94.sql').includes('preventive_decision_threshold_snapshots'),'threshold state and history are durable');
add('V82 gate integration',read('src/lib/preventiveActionDecisionGate.ts').includes('loadPreventiveDecisionThresholds')&&read('src/lib/preventiveActionDecisionGate.ts').includes('thresholds.recommendThreshold'),'decision gate consumes adaptive thresholds');
add('V82 threshold regression',read('src/app/api/testing/preventive-decision-thresholds/route.ts').includes('CONSERVATIVE')&&read('src/app/api/testing/preventive-decision-thresholds/route.ts').includes('TUNED'),'regression covers tightening and bounded tuning');
add('V82 supervision integration',supervisionSources.includes('runPreventiveDecisionThresholdGovernor'),'SLO supervision refreshes adaptive thresholds');
add('V82 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveDecisionThresholdPanel'),'threshold governor is visible');

add('V83 threshold stability governor',read('src/lib/preventiveThresholdStability.ts').includes('evaluateThresholdStability'),'threshold stability engine exists');
add('V83 durable stability state',read('db/v95.sql').includes('preventive_threshold_stability_state')&&read('db/v95.sql').includes('preventive_threshold_stability_snapshots'),'stability state and rollback history are durable');
add('V83 safe rollback target',read('src/lib/preventiveThresholdStability.ts').includes('loadLastSafeSnapshot')&&read('src/lib/preventiveThresholdStability.ts').includes('source_calibration_error<=.12'),'rollback targets only previously safe threshold evidence');
add('V83 rollback integration',supervisionSources.includes('runThresholdStabilityGovernor'),'SLO supervision runs stability check before the preventive decision gate');
add('V83 stability regression',read('src/app/api/testing/preventive-threshold-stability/route.ts').includes("status==='ROLLBACK'"),'regression covers stable and rollback states');
add('V83 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveThresholdStabilityPanel'),'stability governor is visible');

add('V84 threshold recovery governor',read('src/lib/preventiveThresholdRecovery.ts').includes('nextThresholdRecoveryState'),'threshold recovery state machine exists');
add('V84 three-window re-entry',read('src/lib/preventiveThresholdRecovery.ts').includes('streak>=3')&&read('src/lib/preventiveThresholdRecovery.ts').includes("state:'RECOVERING'"),'adaptive re-entry requires three healthy windows');
add('V84 recovery lock integration',read('src/lib/preventiveDecisionThresholds.ts').includes('adaptiveThresholdReentryAllowed')&&read('src/lib/preventiveDecisionThresholds.ts').includes('RECOVERY_LOCK'),'adaptive threshold writes pause while recovery is locked');
add('V84 durable recovery state',read('db/v96.sql').includes('preventive_threshold_recovery_state')&&read('db/v96.sql').includes('preventive_threshold_recovery_snapshots'),'recovery state and history are durable');
add('V84 recovery regression',read('src/app/api/testing/preventive-threshold-recovery/route.ts').includes("state==='LOCKED'")&&read('src/app/api/testing/preventive-threshold-recovery/route.ts').includes("state==='OPEN'"),'regression covers lock, recovery, and re-entry');
add('V84 supervision integration',supervisionSources.includes('runThresholdRecoveryGovernor'),'SLO supervision refreshes threshold recovery');
add('V84 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveThresholdRecoveryPanel'),'threshold recovery is visible');

add('V85 probation governor',read('src/lib/preventiveThresholdProbation.ts').includes('nextThresholdProbationState'),'probation state machine exists');
add('V85 staged influence',read('src/lib/preventiveThresholdProbation.ts').includes("adaptiveWeight:.25")&&read('src/lib/preventiveThresholdProbation.ts').includes("currentStage===2?.50:.75")&&read('src/lib/preventiveThresholdProbation.ts').includes("nextStage===2?.50:.75"),'adaptive influence stages at 25, 50, and 75 percent');
add('V85 threshold weighting',read('src/lib/preventiveDecisionThresholds.ts').includes('applyAdaptiveThresholdWeight')&&read('src/lib/preventiveDecisionThresholds.ts').includes('getAdaptiveThresholdWeight'),'threshold governor consumes probation weight');
add('V85 rollback-only activation',read('src/lib/preventiveThresholdProbation.ts').includes('rollbackReferenceId'),'probation activates only after rollback recovery');
add('V85 durable probation state',read('db/v97.sql').includes('preventive_threshold_probation_state')&&read('db/v97.sql').includes('preventive_threshold_probation_snapshots'),'probation state and history are durable');
add('V85 supervision integration',supervisionSources.includes('runThresholdProbationGovernor'),'SLO supervision refreshes probation before adaptive threshold writes');
add('V85 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveThresholdProbationPanel'),'probation rollout is visible');

add('V86 probation performance governor',read('src/lib/preventiveProbationPerformance.ts').includes('evaluateProbationPerformance'),'probation performance monitor exists');
add('V86 baseline comparison',read('src/lib/preventiveProbationPerformance.ts').includes('baselineCalibrationError')&&read('src/lib/preventiveProbationPerformance.ts').includes('baselineBrierScore'),'probation stages compare to recovery baseline');
add('V86 stage rollback',read('src/lib/preventiveProbationPerformance.ts').includes('rollbackStage')&&read('src/lib/preventiveProbationPerformance.ts').includes("status:'ROLLBACK'"),'material degradation can roll back one probation stage');
add('V86 durable performance state',read('db/v98.sql').includes('preventive_probation_performance_state')&&read('db/v98.sql').includes('preventive_probation_performance_snapshots'),'probation performance and rollback history are durable');
add('V86 performance regression',read('src/app/api/testing/preventive-probation-performance/route.ts').includes("rollback.status==='ROLLBACK'"),'regression covers stable and rollback performance');
add('V86 supervision ordering',supervisionSources.includes('runProbationPerformanceGovernor'),'probation performance runs before adaptive threshold writes');
add('V86 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveProbationPerformancePanel'),'probation performance is visible');

add('V87 champion baseline governor',read('src/lib/preventiveChampionBaseline.ts').includes('shouldPromoteChampionBaseline'),'champion baseline promotion gate exists');
add('V87 full rollout promotion criteria',read('src/lib/preventiveChampionBaseline.ts').includes("probationState==='FULL'")&&read('src/lib/preventiveChampionBaseline.ts').includes('sampleSize>=20'),'promotion requires full rollout and mature evidence');
add('V87 champion baseline persistence',read('db/v99.sql').includes('preventive_champion_baseline_state')&&read('db/v99.sql').includes('preventive_champion_baseline_snapshots'),'champion baseline state and history are durable');
add('V87 V86 baseline handoff',read('src/lib/preventiveProbationPerformance.ts').includes('preventive_champion_baseline_state'),'probation performance prefers the validated champion baseline');
add('V87 baseline regression',read('src/app/api/testing/preventive-champion-baseline/route.ts').includes('yes.eligible')&&read('src/app/api/testing/preventive-champion-baseline/route.ts').includes('!no.eligible'),'promotion regression covers eligible and ineligible cases');
add('V87 supervision integration',supervisionSources.includes('runChampionBaselineGovernor'),'SLO supervision refreshes champion baseline governance');
add('V87 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveChampionBaselinePanel'),'champion baseline is visible');

add('V88 champion baseline health',read('src/lib/preventiveChampionBaselineHealth.ts').includes('evaluateChampionBaselineHealth'),'champion baseline health governor exists');
add('V88 champion retirement',read('src/lib/preventiveChampionBaselineHealth.ts').includes("status:'RETIRE'")&&read('src/lib/preventiveChampionBaselineHealth.ts').includes("source='RETIRED_CHAMPION'"),'stale champions can be retired');
add('V88 fallback behavior',read('src/lib/preventiveProbationPerformance.ts').includes('where singleton_key=1 and promoted_at is not null'),'V86 ignores retired champions and falls back to recovery baseline');
add('V88 durable health state',read('db/v100.sql').includes('preventive_champion_baseline_health_state')&&read('db/v100.sql').includes('preventive_champion_baseline_health_snapshots'),'champion health and retirement history are durable');
add('V88 health regression',read('src/app/api/testing/preventive-champion-baseline-health/route.ts').includes("retire.status==='RETIRE'"),'regression covers active and retirement states');
add('V88 supervision ordering',supervisionSources.includes('runChampionBaselineHealthGovernor'),'champion health is evaluated before V86 baseline comparison');
add('V88 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveChampionBaselineHealthPanel'),'champion baseline health is visible');

add('V89 baseline succession',read('src/lib/preventiveBaselineSuccession.ts').includes('evaluateBaselineSuccession'),'baseline succession governor exists');
add('V89 readiness evidence',read('src/lib/preventiveBaselineSuccession.ts').includes("status:'READY'")&&read('src/lib/preventiveBaselineSuccession.ts').includes('windows.length<3'),'replacement readiness requires multi-window evidence');
add('V89 durable succession',read('db/v101.sql').includes('preventive_baseline_succession_state')&&read('db/v101.sql').includes('preventive_baseline_succession_snapshots'),'succession readiness and history are durable');
add('V89 V86 successor handoff',read('src/lib/preventiveProbationPerformance.ts').includes('preventive_baseline_succession_state')&&read('src/lib/preventiveProbationPerformance.ts').includes("status='READY'"),'V86 uses only validated replacement candidates');
add('V89 regression',read('src/app/api/testing/preventive-baseline-succession/route.ts').includes("ready.status==='READY'")&&read('src/app/api/testing/preventive-baseline-succession/route.ts').includes("idle.status==='IDLE'"),'succession regression covers ready and idle states');
add('V89 supervision ordering',supervisionSources.includes('runBaselineSuccessionGovernor'),'succession is evaluated before probation baseline comparison');
add('V89 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveBaselineSuccessionPanel'),'baseline succession is visible');

add('V90 baseline handoff',read('src/lib/preventiveBaselineHandoff.ts').includes('evaluateSuccessorPromotion'),'successor promotion governor exists');
add('V90 strengthened promotion gates',read('src/lib/preventiveBaselineHandoff.ts').includes('readinessScore>=.80')&&read('src/lib/preventiveBaselineHandoff.ts').includes('candidateSampleSize>=25'),'successor promotion requires stronger evidence than V89 readiness alone');
add('V90 active champion protection',read('src/lib/preventiveBaselineHandoff.ts').includes('hasActiveChampion'),'active champions cannot be replaced');
add('V90 durable handoff',read('db/v102.sql').includes('preventive_baseline_handoff_state')&&read('db/v102.sql').includes('preventive_baseline_handoff_snapshots'),'handoff state and history are durable');
add('V90 champion handoff write',read('src/lib/preventiveBaselineHandoff.ts').includes("'SUCCESSION_CHAMPION'"),'validated successor becomes the new champion baseline');
add('V90 supervision ordering',supervisionSources.includes('runBaselineHandoffGovernor'),'handoff runs after succession readiness');
add('V90 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveBaselineHandoffPanel'),'baseline handoff is visible');

add('V91 successor validation',read('src/lib/preventiveSuccessorValidation.ts').includes('evaluateSuccessorValidation'),'post-handoff successor validation exists');
add('V91 three-window confirmation',read('src/lib/preventiveSuccessorValidation.ts').includes('streak>=3')&&read('src/lib/preventiveSuccessorValidation.ts').includes("status:'CONFIRMED'"),'succession champion requires three healthy validation windows');
add('V91 safe reversion',read('src/lib/preventiveSuccessorValidation.ts').includes("'REVERTED_SUCCESSION_CHAMPION'")&&read('src/lib/preventiveSuccessorValidation.ts').includes("status='BUILDING'"),'failed successor is revoked and succession reopens');
add('V91 durable validation',read('db/v103.sql').includes('preventive_successor_validation_state')&&read('db/v103.sql').includes('preventive_successor_validation_snapshots'),'validation and reversion history are durable');
add('V91 regression',read('src/app/api/testing/preventive-successor-validation/route.ts').includes("healthy.status==='CONFIRMED'")&&read('src/app/api/testing/preventive-successor-validation/route.ts').includes("revert.status==='REVERT'"),'regression covers confirmation and reversion');
add('V91 supervision ordering',supervisionSources.includes('runSuccessorValidationGovernor'),'post-handoff validation runs immediately after handoff');
add('V91 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveSuccessorValidationPanel'),'successor validation is visible');

add('V92 successor graduation',read('src/lib/preventiveSuccessorGraduation.ts').includes('evaluateSuccessorGraduation'),'successor graduation governor exists');
add('V92 confirmed-only graduation',read('src/lib/preventiveSuccessorGraduation.ts').includes("validationStatus==='CONFIRMED'")&&read('src/lib/preventiveSuccessorGraduation.ts').includes('validationStreak>=3'),'graduation requires V91 confirmation');
add('V92 champion source transition',read('src/lib/preventiveSuccessorGraduation.ts').includes("'CONFIRMED_SUCCESSION_CHAMPION'"),'confirmed successor moves into normal champion lifecycle');
add('V92 durable graduation',read('db/v104.sql').includes('preventive_successor_graduation_state')&&read('db/v104.sql').includes('preventive_successor_graduation_snapshots'),'graduation state and history are durable');
add('V92 regression',read('src/app/api/testing/preventive-successor-graduation/route.ts').includes("yes.status==='GRADUATE'")&&read('src/app/api/testing/preventive-successor-graduation/route.ts').includes('!no.eligible'),'regression covers eligible and ineligible graduation');
add('V92 supervision ordering',supervisionSources.includes('runSuccessorGraduationGovernor'),'graduation runs immediately after successor validation');
add('V92 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveSuccessorGraduationPanel'),'successor graduation is visible');

add('V93 lifecycle consistency',read('src/lib/preventiveBaselineConsistency.ts').includes('evaluateBaselineLifecycleConsistency'),'baseline lifecycle consistency evaluator exists');
add('V93 conservative repair set',read('src/lib/preventiveBaselineConsistency.ts').includes('applySafeRepairs')&&read('src/lib/preventiveBaselineConsistency.ts').includes('REPAIR_REQUIRED'),'bounded reconciliation repairs inconsistent lifecycle metadata');
add('V93 no promotion path',!read('src/lib/preventiveBaselineConsistency.ts').includes("source='SUCCESSION_CHAMPION'")&&!read('src/lib/preventiveBaselineConsistency.ts').includes("source='CONFIRMED_SUCCESSION_CHAMPION'"),'reconciler cannot promote champion source');
add('V93 durable consistency',read('db/v105.sql').includes('preventive_baseline_consistency_state')&&read('db/v105.sql').includes('preventive_baseline_consistency_snapshots'),'consistency state and history are durable');
add('V93 regression',read('src/app/api/testing/preventive-baseline-consistency/route.ts').includes("healthy.status==='HEALTHY'")&&read('src/app/api/testing/preventive-baseline-consistency/route.ts').includes("broken.status==='REPAIR_REQUIRED'"),'regression covers healthy and broken lifecycle states');
add('V93 supervision ordering',supervisionSources.includes('runBaselineConsistencyGovernor'),'lifecycle reconciliation runs during SLO supervision');
add('V93 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveBaselineConsistencyPanel'),'lifecycle consistency is visible');

add('V94 governance cycle coordinator',read('src/lib/preventiveBaselineGovernanceCycle.ts').includes('runBaselineGovernanceCycle'),'baseline governance coordinator exists');
add('V94 lease locking',read('src/lib/preventiveBaselineGovernanceCycle.ts').includes("interval '90 seconds'")&&read('db/v106.sql').includes('preventive_baseline_governance_lock'),'database-backed governance lease exists');
add('V94 cycle idempotency',read('src/lib/preventiveBaselineGovernanceCycle.ts').includes('SKIPPED_IDEMPOTENT')&&read('db/v106.sql').includes('cycle_key text not null unique'),'completed minute-bucket cycles are duplicate-safe');
add('V94 transition journal',read('db/v106.sql').includes('preventive_baseline_governance_cycles')&&read('src/lib/preventiveBaselineGovernanceCycle.ts').includes("'COMPLETED'"),'governance cycle journal is durable');
add('V94 SLO coordination',read('src/lib/sloGovernor.ts').includes('runPreventiveSupervisionCycle')&&read('src/lib/preventiveSupervisionCycle.ts').includes('runBaselineGovernanceCycle')&&!read('src/lib/sloGovernor.ts').includes('runBaselineHandoffGovernor'),'SLO supervision reaches baseline governance only through the unified coordinated cycle');
add('V94 regression',read('src/app/api/testing/preventive-baseline-governance-cycle/route.ts').includes('SKIPPED_LOCKED')&&read('src/app/api/testing/preventive-baseline-governance-cycle/route.ts').includes('SKIPPED_IDEMPOTENT'),'regression covers locking and idempotency');
add('V94 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveBaselineGovernanceCyclePanel'),'governance cycle status is visible');

add('V95 governance watchdog',read('src/lib/preventiveBaselineGovernanceWatchdog.ts').includes('runBaselineGovernanceWatchdog'),'governance watchdog exists');
add('V95 heartbeat renewal',read('src/lib/preventiveBaselineGovernanceCycle.ts').includes('heartbeatLease')&&read('src/lib/preventiveBaselineGovernanceCycle.ts').includes("interval '90 seconds'"),'governance cycle renews its lease before each lifecycle step');
add('V95 lease-loss stop',read('src/lib/preventiveBaselineGovernanceCycle.ts').includes('governance lease lost before')&&read('src/lib/preventiveBaselineGovernanceCycle.ts').includes('noteGovernanceLeaseLoss'),'cycle stops and records lease loss instead of continuing');
add('V95 stale recovery',read('src/lib/preventiveBaselineGovernanceWatchdog.ts').includes("status='STARTED'")&&read('src/lib/preventiveBaselineGovernanceWatchdog.ts').includes("interval '3 minutes'"),'stale STARTED cycles are detected by heartbeat timeout');
add('V95 durable watchdog state',read('db/v107.sql').includes('preventive_baseline_governance_watchdog_state')&&read('db/v107.sql').includes('heartbeat_at'),'watchdog state and heartbeats are durable');
add('V95 watchdog regression',read('src/app/api/testing/preventive-baseline-governance-watchdog/route.ts').includes("RECOVERY_REQUIRED"),'watchdog regression covers healthy and recovery-required states');
add('V95 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveBaselineGovernanceWatchdogPanel'),'governance watchdog is visible');

add('V96 unified supervision cycle',read('src/lib/preventiveSupervisionCycle.ts').includes('runPreventiveSupervisionCycle'),'unified supervision coordinator exists');
add('V96 shared predictive context',read('src/lib/predictiveIncidentRisk.ts').includes('context?.patterns')&&read('src/lib/predictiveIncidentRisk.ts').includes('context?.observability'),'predictive risk reuses pattern and observability evidence');
add('V96 shared ranking context',read('src/lib/preventiveActionRanking.ts').includes('context?.risk')&&read('src/lib/preventiveActionRanking.ts').includes('context?.learning'),'ranking reuses risk and learning evidence');
add('V96 shared threshold context',read('src/lib/preventiveDecisionThresholds.ts').includes('context?.calibration'),'threshold governor reuses calibration evidence');
add('V96 shared decision context',read('src/lib/preventiveActionDecisionGate.ts').includes('context?.ranking')&&read('src/lib/preventiveActionDecisionGate.ts').includes('context?.observability')&&read('src/lib/preventiveActionDecisionGate.ts').includes('context?.thresholds'),'decision gate reuses ranking, observability, and threshold evidence');
add('V96 SLO consolidation',read('src/lib/sloGovernor.ts').includes('runPreventiveSupervisionCycle')&&!read('src/lib/sloGovernor.ts').includes('runPreventiveActionRanking')&&!read('src/lib/sloGovernor.ts').includes('runPreventiveActionDecisionGate'),'SLO supervision calls one unified preventive cycle');
add('V96 durable cycle snapshots',read('db/v108.sql').includes('preventive_supervision_cycle_snapshots')&&read('db/v108.sql').includes('evidence_digest'),'shared evidence and outputs are durably snapshotted');
add('V96 reuse regression',read('src/app/api/testing/preventive-supervision-cycle/route.ts').includes('reusedContextCount===8'),'regression verifies eight avoided evidence rebuilds');
add('V96 supervision lease',read('src/lib/preventiveSupervisionCycle.ts').includes("interval '5 minutes'")&&read('db/v108.sql').includes('locked_until timestamptz'),'unified supervision cycle suppresses concurrent execution');
add('V96 lease regression',read('src/app/api/testing/preventive-supervision-cycle/route.ts').includes("SKIPPED_LOCKED"),'supervision regression covers concurrent lock suppression');
add('V96 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PreventiveSupervisionCyclePanel'),'unified supervision cycle is visible');

add('V97 explicit typecheck script',pkg.scripts?.typecheck==='tsc --noEmit','TypeScript-only gate is explicit');
add('V97 verify workflow typecheck',read('.github/workflows/verify.yml').includes('npm run typecheck'),'primary verification includes explicit typecheck');
add('V97 production workflow typecheck',read('.github/workflows/deploy-production.yml').includes('npm run typecheck'),'production deploy includes explicit typecheck');
add('V97 production predeploy smoke',read('.github/workflows/deploy-production.yml').includes('Predeploy local smoke')&&read('.github/workflows/deploy-production.yml').includes('Predeploy local load check'),'manual/automatic production deploys run local smoke and load gates');
add('V97 ML compile gate',read('.github/workflows/deploy-production.yml').includes('python3 -m py_compile ml-service/app.py'),'production deploy compiles ML service before promotion');
add('V97 execution certification',read('src/lib/releaseExecutionCertification.ts').includes('evaluateReleaseExecutionCertification'),'commit-specific execution certification exists');
add('V97 strict certification integration',read('src/lib/productionCertification.ts').includes('currentReleaseExecutionCertification')&&read('src/lib/productionCertification.ts').includes('current-release execution certificate'),'strict runtime certification consumes execution evidence');
add('V97 production evidence post',read('.github/workflows/deploy-production.yml').includes('/api/release/execution-certification')&&read('.github/workflows/deploy-production.yml').includes('remoteSmokePassed:true'),'production workflow records full execution evidence before strict certification');
add('V97 durable execution history',read('db/v109.sql').includes('release_execution_certifications'),'execution certifications are durable');
add('V97 regression endpoint',read('src/app/api/testing/release-execution-certification/route.ts').includes('fail.blockers.length===2'),'execution certification regression covers passing and failed evidence');
add('V97 V1 readiness gate',read('src/lib/v1ReleaseReadiness.ts').includes("'release-execution'"),'V1 readiness exposes execution evidence as a required gate');
add('V97 CI evidence artifact',read('.github/workflows/verify.yml').includes('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02')&&read('scripts/write-execution-evidence.mjs').includes('sha256'),'verification produces inspectable hashed execution evidence with immutable artifact action pin');
add('V97 compile regression repair',read('src/lib/preventiveThresholdRecovery.ts').includes('export type ThresholdRecoverySummary')&&read('src/lib/preventiveThresholdStability.ts').includes('export type ThresholdStabilitySummary')&&read('src/lib/preventiveChampionBaseline.ts').includes('export type ChampionBaselineSummary'),'V96 TypeScript inference regressions are repaired with explicit summary contracts');
add('V97 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('ReleaseExecutionCertificationPanel'),'execution certification is visible');

add('V97 smoke authenticated mutations',read('scripts/smoke.mjs').includes("headers.authorization=\`Bearer \${secret}\`"),'local smoke mutations authenticate when deployment secrets are configured');

add('V99 promotion provenance schema',exists('db/v110.sql')&&read('db/v110.sql').includes('release_promotion_provenance'),'durable production promotion ledger exists');
add('V99 promotion provenance evaluator',read('src/lib/releasePromotionProvenance.ts').includes('evaluateReleasePromotionEvidence')&&read('src/lib/releasePromotionProvenance.ts').includes('currentReleasePromotionProvenance'),'promotion evidence is evaluated and queryable');
add('V99 promotion provenance API',exists('src/app/api/release/promotion-provenance/route.ts')&&exists('src/app/api/testing/release-promotion-provenance/route.ts'),'promotion provenance API and regression endpoint exist');
add('V99 promotion consistency gate',read('src/lib/productionCertification.ts').includes('promotionProvenance')&&read('src/lib/productionCertification.ts').includes('promoted commit'),'production certification fails closed on recorded commit drift');
add('V99 readiness evidence',read('src/lib/v1ReleaseReadiness.ts').includes("'promotion-provenance'")&&read('src/lib/v1ReleaseReadiness.ts').includes('promotionProvenanceRecorded'),'V1 readiness exposes promotion provenance');
add('V99 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('ReleasePromotionProvenancePanel'),'promotion provenance is visible in System view');
add('V99 production promotion writer',read('.github/workflows/deploy-production.yml').includes('/api/release/promotion-provenance')&&read('.github/workflows/deploy-production.yml').includes('workflowRunId'),'successful production workflow persists exact promotion provenance');
add('V99 release notes',exists('EDGEFORCE_V99_RELEASE.md'),'V99 release documentation exists');

add('V100 post-promotion schema',exists('db/v111.sql')&&read('db/v111.sql').includes('release_post_promotion_verifications'),'durable live verification certificates exist');
add('V100 post-promotion evaluator',read('src/lib/postPromotionVerification.ts').includes('evaluatePostPromotionVerification')&&read('src/lib/postPromotionVerification.ts').includes('latestPostPromotionVerification'),'live verification evaluator exists');
add('V100 post-promotion API',exists('src/app/api/release/post-promotion-verification/route.ts')&&exists('src/app/api/testing/post-promotion-verification/route.ts'),'live verification API and regression endpoint exist');
add('V100 live commit health identity',read('src/app/api/health/route.ts').includes('deploymentCommit'),'health exposes deployed commit identity');
add('V100 strict live verification gate',read('src/lib/productionCertification.ts').includes('postPromotionVerification')&&read('src/lib/productionCertification.ts').includes('verified live commit'),'strict certification checks live verification consistency');
add('V100 readiness evidence',read('src/lib/v1ReleaseReadiness.ts').includes("'post-promotion-verification'")&&read('src/lib/v1ReleaseReadiness.ts').includes('postPromotionVerified'),'V1 readiness exposes live verification');
add('V100 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PostPromotionVerificationPanel'),'live verification is visible in System view');
add('V100 production verifier',read('.github/workflows/deploy-production.yml').includes('/api/release/post-promotion-verification'),'production workflow records live verification after promotion');
add('V100 release notes',exists('EDGEFORCE_V100_RELEASE.md'),'V100 release documentation exists');

add('V101 rollback reconciliation schema',exists('db/v112.sql')&&read('db/v112.sql').includes('release_rollback_reconciliations'),'durable rollback reconciliation ledger exists');
add('V101 rollback reconciler',read('src/lib/releaseRollbackReconciliation.ts').includes('reconcileReleaseRollback')&&read('src/lib/releaseRollbackReconciliation.ts').includes('latestReleaseRollbackReconciliation'),'rollback evidence reconciler exists');
add('V101 rollback API',exists('src/app/api/release/rollback-reconciliation/route.ts')&&exists('src/app/api/testing/rollback-reconciliation/route.ts'),'rollback API and regression endpoint exist');
add('V101 promotion revocation',read('src/lib/releaseRollbackReconciliation.ts').includes('update release_promotion_provenance')&&read('src/lib/releaseRollbackReconciliation.ts').includes('rolled_back=true'),'rollback revokes promotion provenance');
add('V101 live verification invalidation',read('src/lib/releaseRollbackReconciliation.ts').includes('update release_post_promotion_verifications')&&read('src/lib/releaseRollbackReconciliation.ts').includes('certified=false'),'rollback invalidates post-promotion certificate');
add('V101 strict rollback blocker',read('src/lib/productionCertification.ts').includes('rollbackReconciliation')&&read('src/lib/productionCertification.ts').includes('rollback reconciliation'),'strict production certification checks rollback state');
add('V101 readiness evidence',read('src/lib/v1ReleaseReadiness.ts').includes("'rollback-reconciliation'")&&read('src/lib/v1ReleaseReadiness.ts').includes('rollbackReconciled'),'V1 readiness exposes rollback reconciliation');
add('V101 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('RollbackReconciliationPanel'),'rollback reconciliation is visible in System view');
add('V101 production rollback writer',read('.github/workflows/deploy-production.yml').includes('/api/release/rollback-reconciliation')&&read('.github/workflows/deploy-production.yml').includes('PREVIOUS_DEPLOYMENT_ID'),'rollback workflow reconciles failed evidence');
add('V101 release notes',exists('EDGEFORCE_V101_RELEASE.md'),'V101 release documentation exists');

add('V102 hosted preview workflow',exists('.github/workflows/preview-cloudflare.yml')&&read('.github/workflows/preview-cloudflare.yml').includes('preview:cloudflare')&&read('.github/workflows/preview-cloudflare.yml').includes('--temporary'),'repo-owned permanent/temporary Cloudflare PR preview exists');
add('V102 certified preview artifact',read('.github/workflows/preview-cloudflare.yml').includes('dist/server/wrangler.json')&&exists('scripts/prepare-cloudflare-temporary-preview.mjs')&&read('package.json').includes('wrangler preview --config dist/server/wrangler.json'),'hosted preview uses generated Worker config with isolated temporary fallback');
add('V102 hosted preview smoke',exists('scripts/cloudflare-preview-smoke.mjs')&&read('.github/workflows/preview-cloudflare.yml').includes('cloudflare-preview-smoke.mjs'),'hosted preview identity smoke exists');
add('V102 preview URL extraction',exists('scripts/extract-cloudflare-preview-url.mjs'),'machine-readable preview URL extraction exists');
add('V102 preview cleanup',read('.github/workflows/preview-cloudflare.yml').includes('preview delete')||read('.github/workflows/preview-cloudflare.yml').includes('preview:cloudflare:delete'),'PR close cleanup exists');
add('V102 Cloudflare verify parity',read('.github/workflows/verify-cloudflare.yml').includes('npm run preflight:cloudflare')&&read('.github/workflows/verify-cloudflare.yml').includes('set -o pipefail'),'verification uses preflight and pipefail');
add('V102 Cloudflare deploy pipefail',read('.github/workflows/deploy-cloudflare.yml').includes('set -o pipefail'),'production Cloudflare build cannot hide failures behind tee');
add('Versioned Cloudflare artifact identity',/edgeforce-v\d+-vinext-build/.test(read('.github/workflows/verify-cloudflare.yml'))&&/edgeforce-v\d+-cloudflare-build/.test(read('.github/workflows/deploy-cloudflare.yml')),'Cloudflare verification and deployment artifacts carry explicit release identity');
add('V102 health capability',read('src/app/api/health/route.ts').includes('cloudflareHostedPreviewParity:true'),'health exposes hosted preview parity');
add('V102 release notes',exists('EDGEFORCE_V102_RELEASE.md'),'V102 release documentation exists');

add('V103 convergence schema',exists('db/v113.sql')&&read('db/v113.sql').includes('release_platform_convergence'),'durable cross-platform convergence ledger exists');
add('V103 convergence evaluator',read('src/lib/releasePlatformConvergence.ts').includes('recordPlatformEvidence')&&read('src/lib/releasePlatformConvergence.ts').includes('latestPlatformConvergence'),'platform convergence evaluator exists');
add('V103 convergence API',exists('src/app/api/release/platform-convergence/route.ts')&&exists('src/app/api/testing/platform-convergence/route.ts'),'convergence API and regression endpoint exist');
add('V103 Vercel evidence writer',read('.github/workflows/deploy-production.yml').includes('/api/release/platform-convergence')&&read('.github/workflows/deploy-production.yml').includes('platform:"vercel"'),'Vercel production writes convergence evidence');
add('V103 Cloudflare evidence writer',read('.github/workflows/deploy-cloudflare.yml').includes('/api/release/platform-convergence')&&read('.github/workflows/deploy-cloudflare.yml').includes('platform:"cloudflare"'),'Cloudflare production writes convergence evidence');
add('V103 strict convergence gate',read('src/lib/productionCertification.ts').includes('platformConvergence')&&read('src/lib/productionCertification.ts').includes('platform convergence'),'strict production certification checks convergence');
add('V103 readiness evidence',read('src/lib/v1ReleaseReadiness.ts').includes("'platform-convergence'")&&read('src/lib/v1ReleaseReadiness.ts').includes('platformConverged'),'V1 readiness exposes cross-platform convergence');
add('V103 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('PlatformConvergencePanel'),'platform convergence is visible in System view');
add('V103 health capability',read('src/app/api/health/route.ts').includes('crossPlatformProductionConvergence:true'),'health exposes convergence capability');
add('V103 release notes',exists('EDGEFORCE_V103_RELEASE.md'),'V103 release documentation exists');

add('V104 closure schema',exists('db/v114.sql')&&read('db/v114.sql').includes('release_final_closures'),'durable final closure ledger exists');
add('V104 closure evaluator',read('src/lib/finalProductionClosure.ts').includes('evaluateFinalProductionClosure')&&read('src/lib/finalProductionClosure.ts').includes('saveFinalProductionClosure'),'final production closure evaluator exists');
add('V104 closure API',exists('src/app/api/release/final-closure/route.ts')&&exists('src/app/api/testing/final-closure/route.ts'),'final closure API and regression endpoint exist');
add('V104 dual-platform closure writers',read('.github/workflows/deploy-production.yml').includes('/api/release/final-closure')&&read('.github/workflows/deploy-cloudflare.yml').includes('/api/release/final-closure'),'both production workflows can seal closure');
add('V104 Cloudflare commit stamp',exists('scripts/stamp-cloudflare-deployment.mjs')&&read('.github/workflows/deploy-cloudflare.yml').includes('stamp-cloudflare-deployment.mjs'),'Cloudflare runtime receives exact deployment commit');
add('V104 convergence fail-fast',read('src/app/api/release/platform-convergence/route.ts').includes('status:invalid?422:200'),'invalid convergence evidence fails fast');
add('V104 bootstrap-safe convergence',read('src/lib/productionCertification.ts').includes('awaiting evidence from the second production platform'),'one-sided convergence remains bootstrap-safe');
add('V104 strict closure integration',read('src/lib/productionCertification.ts').includes('finalClosure')&&read('src/lib/productionCertification.ts').includes('converged durable evidence'),'production certification consumes final closure state');
add('V104 readiness evidence',read('src/lib/v1ReleaseReadiness.ts').includes("'final-production-closure'")&&read('src/lib/v1ReleaseReadiness.ts').includes('finalProductionClosed'),'V1 readiness exposes final closure');
add('V104 dashboard surface',read('src/components/OperatorCommandCenter.tsx').includes('FinalProductionClosurePanel'),'final closure is visible in System view');
add('V104 health capability',read('src/app/api/health/route.ts').includes('finalProductionClosure:true'),'health exposes final closure capability');
add('V104 rollback description',!read('.github/workflows/deploy-production.yml').includes('V74%20SLO'),'rollback description no longer carries stale V74 identity');
add('V104 release notes',exists('EDGEFORCE_V104_RELEASE.md'),'V104 release documentation exists');

add('V105 Vercel verified-main trigger',(
 read('.github/workflows/deploy-production.yml').includes('workflows: ["Verify Edgeforce"]')&&
 read('.github/workflows/deploy-production.yml').includes("head_branch == 'main'")&&
 read('.github/workflows/deploy-production.yml').includes('workflow_run.head_sha')
)||(
 read('.github/workflows/deploy-production.yml').includes('push:')&&
 read('.github/workflows/deploy-production.yml').includes('branches: [main]')&&
 read('.github/workflows/deploy-production.yml').includes('DEPLOY_COMMIT: ${{ github.sha }}')&&
 read('.github/workflows/deploy-production.yml').includes('Verify prediction persistence against PostgreSQL')&&
 read('.github/workflows/deploy-production.yml').includes('Verify shared SharpAPI budget against PostgreSQL')&&
 read('.github/workflows/deploy-production.yml').includes('npm run lint')&&
 read('.github/workflows/deploy-production.yml').includes('npm run typecheck')&&
 read('.github/workflows/deploy-production.yml').includes('npm run build')&&
 read('.github/workflows/deploy-production.yml').includes('npm run release-audit')&&
 read('.github/workflows/deploy-production.yml').includes('Predeploy local smoke')&&
 read('.github/workflows/deploy-production.yml').includes('Predeploy local load check')
)||(
 read('.github/workflows/deploy-production.yml').includes('on:\n  workflow_dispatch:')&&
 read('config/vercel-team-governor.json').includes('"autoRelease": false')&&
 read('config/vercel-team-governor.json').includes('"standbyRole": "manual-disaster-recovery"')&&
 read('.github/workflows/deploy-cloudflare.yml').includes('Require both exact-main certification workflows')
),'Vercel production is either exact-main auto-verified or intentionally manual-only standby behind Cloudflare exact-main certification');
add('V105 Cloudflare verified-main trigger',read('.github/workflows/deploy-cloudflare.yml').includes('workflows: ["Verify Edgeforce"]')&&read('.github/workflows/deploy-cloudflare.yml').includes("head_branch == 'main'")&&read('.github/workflows/deploy-cloudflare.yml').includes('workflow_run.head_sha'),'Cloudflare production deploy is pinned to the successful verified main SHA');
add('V105 cross-platform source parity',(
 read('.github/workflows/deploy-production.yml').includes('DEPLOY_COMMIT: ${{ github.event.workflow_run.head_sha || github.sha }}')||
 (
  read('.github/workflows/deploy-production.yml').includes('DEPLOY_COMMIT: ${{ github.sha }}')&&
  read('.github/workflows/deploy-production.yml').includes('Verify prediction persistence against PostgreSQL')&&
  read('.github/workflows/deploy-production.yml').includes('Verify shared SharpAPI budget against PostgreSQL')&&
  read('.github/workflows/deploy-production.yml').includes('Predeploy local smoke')&&
  read('.github/workflows/deploy-production.yml').includes('Predeploy local load check')
 )
)&&read('.github/workflows/deploy-cloudflare.yml').includes('DEPLOY_COMMIT: ${{ github.event.workflow_run.head_sha || github.sha }}'),'both production paths derive identity from an exact verified main source');
add('V105 Cloudflare exact checkout',read('.github/workflows/deploy-cloudflare.yml').includes('ref: \${{ github.event.workflow_run.head_sha || github.sha }}'),'Cloudflare checks out the exact verified commit');
add('V105 Cloudflare runtime commit stamp',read('scripts/stamp-cloudflare-deployment.mjs').includes('process.env.DEPLOYMENT_COMMIT||process.env.GITHUB_SHA'),'Cloudflare runtime stamp prefers the verified deployment commit');
add('V105 manual fallback preserved',read('.github/workflows/deploy-production.yml').includes('workflow_dispatch:')&&read('.github/workflows/deploy-cloudflare.yml').includes('workflow_dispatch:'),'both production paths retain operator-triggered fallback');
add('V105 closure writer parity',read('.github/workflows/deploy-production.yml').includes('/api/release/final-closure')&&read('.github/workflows/deploy-cloudflare.yml').includes('/api/release/final-closure'),'both production paths attempt durable final closure');
add('V105 health capability',read('src/app/api/health/route.ts').includes('productionClosureOrchestration:true'),'health exposes production closure orchestration');
add('V105 release notes',exists('EDGEFORCE_V105_RELEASE.md'),'V105 release documentation exists');
add('V106 Vercel stale project ID removed',!read('.github/workflows/deploy-production.yml').includes('prj_CJokQ1ngz20Rwb7eNjk9gf3HjFHo'),'production deploy no longer trusts the stale Vercel project ID');
add('V106 Vercel authorization preflight',read('.github/workflows/deploy-production.yml').includes('Verify Vercel team authorization')&&read('.github/workflows/deploy-production.yml').includes('project inspect "$VERCEL_PROJECT_NAME"'),'Vercel team authorization is checked before deployment');
add('V106 Vercel dynamic mapping',read('.github/workflows/deploy-production.yml').includes('Resolve live Vercel project mapping')&&read('.github/workflows/deploy-production.yml').includes('.vercel/project.json')&&read('.github/workflows/deploy-production.yml').includes('VERCEL_PROJECT_ID=$RESOLVED_PROJECT_ID'),'live Vercel project mapping drives deployment and rollback');
add('V106 Cloudflare account fallback',read('.github/workflows/deploy-cloudflare.yml').includes("secrets.CLOUDFLARE_ACCOUNT_ID || 'de9b84b39940a0b5b622ae5d27b415dc'"),'Cloudflare account ID uses repository-safe fallback');
add('V106 Cloudflare database fallback',read('.github/workflows/deploy-cloudflare.yml').includes('secrets.EDGEFORCE_DATABASE_URL || secrets.DATABASE_URL'),'Cloudflare accepts either database secret name');
add('V106 Cloudflare prerequisite diagnostics',read('.github/workflows/deploy-cloudflare.yml').includes('Missing Cloudflare production prerequisites')&&read('.github/workflows/deploy-cloudflare.yml').includes('CLOUDFLARE_API_TOKEN'),'missing production credentials are reported explicitly');
add('V106 health capability',read('src/app/api/health/route.ts').includes('productionCredentialRecovery:true'),'health exposes production credential recovery');
add('V106 release notes',exists('EDGEFORCE_V106_RELEASE.md'),'V106 release documentation exists');
add('V107 documented Vercel curl syntax',read('.github/workflows/deploy-production.yml').includes('vercel curl \"/api/release/error-budget\" --deployment \"$PREVIOUS_DEPLOYMENT_URL\"')&&!read('.github/workflows/deploy-production.yml').includes('vercel --token=\"$VERCEL_TOKEN\" --scope=\"$VERCEL_SCOPE\" curl'),'production protected requests keep the documented vercel curl command form');
add('V107 protected remote smoke syntax',read('scripts/remote-smoke.mjs').includes("const args=['curl',url];"),'remote smoke uses the native Vercel curl subcommand');
add('V107 Cloudflare migration database handoff',read('.github/workflows/deploy-cloudflare.yml').includes('DATABASE_URL: ${{ secrets.EDGEFORCE_DATABASE_URL || secrets.DATABASE_URL }}'),'Cloudflare migration receives either supported database secret');
add('V107 health capability',read('src/app/api/health/route.ts').includes('productionTransportRepair:true'),'health exposes production transport repair');
add('V107 release notes',exists('EDGEFORCE_V107_RELEASE.md'),'V107 release documentation exists');
add('V108 base schema bootstrap',read('scripts/migrate.mjs').includes("db','schema.sql")&&read('scripts/migrate.mjs').includes("console.log('apply base schema')")&&read('scripts/migrate.mjs').includes('await sql.unsafe(baseSchema)'),'fresh databases apply the idempotent base schema before versioned migrations');
add('V108 native Vercel curl auth',!read('.github/workflows/deploy-production.yml').includes('vercel curl "/api/release/error-budget" --deployment "$PREVIOUS_DEPLOYMENT_URL" --token=')&&read('.github/workflows/deploy-production.yml').includes('vercel curl "/api/release/error-budget" --deployment "$PREVIOUS_DEPLOYMENT_URL"'),'protected requests rely on linked-project Vercel auth instead of passing CLI flags through native curl');
add('V108 remote smoke native curl',read('scripts/remote-smoke.mjs').includes("const args=['curl',url];"),'remote smoke uses native Vercel curl syntax without passthrough auth flags');
add('V108 health capability',read('src/app/api/health/route.ts').includes('productionBootstrapRepair:true'),'health exposes production bootstrap repair');
add('V108 release notes',exists('EDGEFORCE_V108_RELEASE.md'),'V108 release documentation exists');
add('V109 legacy prediction snapshot bridge',read('scripts/migrate.mjs').includes('reconcile legacy prediction_market_snapshots schema')&&read('scripts/migrate.mjs').includes('prediction_market_snapshots_venue_contract_hour_key'),'legacy prediction-market schemas are reconciled before historical migrations run');
add('V109 pre-V74 SLO bootstrap bridge',read('.github/workflows/deploy-production.yml').includes('CURRENT_MAJOR="${CURRENT_VERSION%%.*}"')&&read('.github/workflows/deploy-production.yml').includes('[ "$CURRENT_MAJOR" -lt 74 ]')&&read('.github/workflows/deploy-production.yml').includes('legacy bootstrap safety check'),'verified legacy production releases can cross the SLO-governor boundary without disabling fail-closed health checks');
add('V109 health capability',read('src/app/api/health/route.ts').includes('productionLegacyBridgeRepair:true'),'health exposes production legacy bridge repair');
add('V109 release notes',exists('EDGEFORCE_V109_RELEASE.md'),'V109 release documentation exists');
add('V110 legacy athlete schema bridge',read('scripts/migrate.mjs').includes('reconcile legacy athletes schema')&&read('scripts/migrate.mjs').includes('athletes_sport_normalized_name_key'),'legacy athlete records are upgraded to the V41 identity contract before migration replay');
add('V110 legacy player stat bridge',read('scripts/migrate.mjs').includes('reconcile legacy player_game_stats schema')&&read('scripts/migrate.mjs').includes('player_game_stats_athlete_event_source_key'),'legacy player stat rows are upgraded to the V41 multi-source contract');
add('V110 layered pre-V74 readiness',read('.github/workflows/deploy-production.yml').includes('layered legacy bootstrap safety checks')&&read('.github/workflows/deploy-production.yml').includes('legacyHealthFallback')&&read('.github/workflows/deploy-production.yml').includes('Legacy production health check is not valid healthy JSON'),'legacy production can bootstrap through health/readiness when newer observability endpoints do not exist');
add('V110 health capability',read('src/app/api/health/route.ts').includes('legacySchemaReadinessBridge:true'),'health exposes legacy schema readiness bridge');
add('V110 release notes',exists('EDGEFORCE_V110_RELEASE.md'),'V110 release documentation exists');
add('V111 Vercel cron-plan bridge',read('.github/workflows/deploy-production.yml').includes('Prepare Vercel Hobby-compatible deployment artifact')&&read('.github/workflows/deploy-production.yml').includes("jq 'del(.crons)' vercel.json")&&read('.github/workflows/deploy-production.yml').includes("jq 'del(.crons)' .vercel/output/config.json"),'Vercel prebuilt production artifacts remove cron registration while Cloudflare remains the canonical scheduler');
add('V111 live odds safe bootstrap',read('src/lib/providers/theOddsApi.ts').includes('upcoming-us-h2h')&&read('src/lib/providers/theOddsApi.ts').includes('provider-safe US h2h baseline'),'The Odds API retries rejected or empty primary bootstrap requests with a real US h2h baseline');
add('V111 provider error detail',read('src/lib/providers/theOddsApi.ts').includes('parsed.error_code')&&read('.github/workflows/deploy-cloudflare.yml').includes('/tmp/provider-certification.json')&&read('.github/workflows/deploy-production.yml').includes('edgeforce-provider-cert.err'),'provider failures preserve upstream API detail and deployment workflows print certification evidence');
add('V111 health capability',read('src/app/api/health/route.ts').includes('providerDeploymentRecovery:true'),'health exposes provider deployment recovery');
add('V111 release notes',exists('EDGEFORCE_V111_RELEASE.md'),'V111 release documentation exists');
add('V112 quota-aware persisted odds fallback',read('src/lib/providerCertification.ts').includes("providerId:'persisted-live-odds'")&&read('src/lib/providerCertification.ts').includes('ODDS_CERTIFICATION_STORED_MAX_AGE_MIN')&&read('src/lib/providerCertification.ts').includes('Live odds provider quota is exhausted'),'quota exhaustion can certify only recent persisted real sportsbook rows with explicit degraded evidence');
add('V112 no-demo degraded certification',read('src/lib/providerCertification.ts').includes('Fallback is production real-data only')&&read('src/lib/productionCertification.ts').includes('certified persisted real odds')&&read('src/lib/productionCertification.ts').includes('certified live pulse continuity'),'strict certification permits only certified real-data continuity paths; demo data remains excluded');
add('V112 usable real-data deployment probe',read('src/app/api/live-data/status/route.ts').includes('requireUsable')&&read('.github/workflows/deploy-production.yml').includes('requireUsable=1&maxStoredAgeMin=90')&&(read('.github/workflows/deploy-cloudflare.yml').includes('requireUsable=1&maxStoredAgeMin=90')||(read('.github/workflows/deploy-cloudflare.yml').includes('Observe live sportsbook continuity without blocking platform launch')&&read('src/app/api/launch-doctor/route.ts').includes('recommendationBlockers')&&read('src/lib/providers/ingest.ts').includes('production demo fallback is disabled'))),'production recommendation paths still reject unavailable/demo sportsbook data even when Cloudflare platform health is independently deployable');
add('V112 health capability',read('src/app/api/health/route.ts').includes('quotaDegradedProviderCertification:true'),'health exposes quota-degraded provider certification');
add('V112 live score mesh',exists('src/lib/liveScoreMesh.ts')&&read('src/lib/liveScoreMesh.ts').includes('nhl-web')&&read('src/lib/liveScoreMesh.ts').includes('mlb-statsapi')&&read('src/lib/liveScoreMesh.ts').includes('espn-public'),'live score mesh combines NHL, MLB and broad ESPN public game-state feeds');
add('V112 live score API',exists('src/app/api/live-scores/route.ts')&&read('src/app/api/live-board/route.ts').includes('fetchLiveScoreMesh'),'live score mesh is exposed directly and integrated into the one-second live board');
add('V112 live timing UI',read('src/components/Dashboard.tsx').includes('LIVE GAME CLOCK MESH')&&read('src/components/Dashboard.tsx').includes('liveScores.liveGames'),'dashboard surfaces live scores, game state and clocks');
add('V112 FanDuel keyless pulse',exists('src/lib/providers/fanLineWire.ts')&&read('src/lib/providers/fanLineWire.ts').includes('fanlinewire.com/odds.json')&&read('src/lib/providers/fanLineWire.ts').includes('Math.max(10000'),'FanDuel keyless public snapshot is integrated with its documented 10-second floor');
add('V112 odds pulse API',exists('src/app/api/odds-pulse/route.ts')&&read('src/app/api/live-board/route.ts').includes('fetchFanDuelOddsPulse'),'FanDuel odds pulse is exposed directly and embedded in the live board');
add('V112 pulse health disclosure',read('src/components/Dashboard.tsx').includes('FANDUEL PULSE')&&read('src/app/api/health/route.ts').includes('fanduelKeylessOddsPulse:true'),'dashboard and health expose FanDuel pulse state without hiding degradation');
add('V112 release notes',exists('EDGEFORCE_V112_RELEASE.md'),'V112 release documentation exists');
add('V113 SportsGameOdds adapter',exists('src/lib/providers/sportsGameOdds.ts')&&read('src/lib/providers/config.ts').includes("url:'sports-game-odds://live-board'")&&read('src/lib/providers/http.ts').includes('fetchSportsGameOddsBoard'),'optional SportsGameOdds key is a native normalized odds source');
add('V113 odds request coalescing',read('src/lib/providers/odds.ts').includes('oddsPanelInFlight')&&read('src/lib/providers/odds.ts').includes('ODDS_PANEL_CACHE_MS'),'concurrent odds-board requests share one provider fetch');
add('V113 latency freshness scoring',read('src/lib/providers/odds.ts').includes('latencyFactor')&&read('src/lib/providers/odds.ts').includes('freshnessFactor')&&read('src/lib/providers/odds.ts').includes('transportScore'),'provider consensus weighting rewards fresher lower-latency feeds');
add('V113 adaptive live score cadence',read('src/lib/liveScoreMesh.ts').includes('nativeLiveTtlMs')&&read('src/lib/liveScoreMesh.ts').includes('espnLiveTtlMs')&&read('src/lib/liveScoreMesh.ts').includes('inFlight')&&read('src/lib/liveScoreMesh.ts').includes('staleFallbackMs'),'live game-state feeds use source-specific live/idle cadence, request coalescing and stale-if-error continuity');
add('V113 FanDuel pulse coalescing',read('src/lib/providers/fanLineWire.ts').includes('inFlight')&&read('src/lib/providers/fanLineWire.ts').includes('FANLINEWIRE_STALE_FALLBACK_MS'),'FanDuel pulse enforces one in-flight refresh and bounded stale fallback');
add('V113 adaptive odds refresh',read('src/lib/providers/ingest.ts').includes('adaptiveLiveRefreshMs')&&read('src/lib/providers/ingest.ts').includes('ODDS_LIVE_REFRESH_MS')&&read('src/app/api/live-board/route.ts').includes('ingestion.liveRefreshMs'),'stored odds no longer suppress provider refresh beyond the configured source cadence');
add('V113 transport diagnostics',exists('src/app/api/network/transport/route.ts')&&read('src/app/api/network/transport/route.ts').includes('providerRequestCoalescing'),'production transport diagnostics expose source cadence and provider configuration without secrets');
add('V113 transport UI',read('src/components/Dashboard.tsx').includes('FASTEST FEED')&&read('src/components/Dashboard.tsx').includes('fastestProviderLatency'),'dashboard surfaces active provider latency');
add('V113 health capability',read('src/app/api/health/route.ts').includes('highSpeedProviderTransport:true')&&read('src/app/api/health/route.ts').includes('sportsGameOddsAdapter:true'),'health exposes V113 high-speed transport capabilities');
add('V113 release notes',exists('EDGEFORCE_V113_RELEASE.md'),'V113 release documentation exists');
add('V114 exact Cloudflare identity convergence',read('.github/workflows/deploy-cloudflare.yml').includes('Wait for exact Worker release identity')&&read('.github/workflows/deploy-cloudflare.yml').includes(".version==$version and .modelVersion==$model and .deploymentCommit==$commit"),'Cloudflare certification waits for the exact release version, model and commit instead of accepting a stale worker during propagation');
add('V119 staged production environment',read('.github/workflows/deploy-production.yml').includes('--prebuilt\n            --prod\n            --skip-domain')&&read('.github/workflows/deploy-production.yml').includes('Verify candidate target and unchanged production alias')&&read('.github/workflows/deploy-production.yml').includes('Promote certified candidate to production'),'production-target artifact stays unaliased until all hosted gates pass');
add('V119 actual production alias proof',read('.github/workflows/deploy-production.yml').includes('/v4/aliases/$PRODUCTION_ALIAS?projectId=$VERCEL_PROJECT_ID&teamId=$VERCEL_ORG_ID')&&read('.github/workflows/deploy-production.yml').includes('EXPECTED_DEPLOYMENT_ID="$CANDIDATE_DEPLOYMENT_ID"')&&read('.github/workflows/deploy-production.yml').includes('--deployment "https://$PRODUCTION_ALIAS"')&&!read('.github/workflows/deploy-production.yml').includes('target=production&state=READY&limit=1'),'live alias and runtime commit are verified instead of assuming the newest production deployment is current');
add('V114 SLO remediation mode',read('.github/workflows/deploy-production.yml').includes('EDGEFORCE_REMEDIATION_DEPLOY=true')&&read('.github/workflows/deploy-production.yml').includes('SLO_REMEDIATION_ACCEPTED')&&read('src/lib/productionLaunch.ts').includes("'SLO_REMEDIATION_ACCEPTED'")&&read('src/lib/productionCertification.ts').includes("remediationMode=process.env.EDGEFORCE_REMEDIATION_DEPLOY==='true'"),'a frozen prior production release can stage a remediation candidate without bypassing candidate health gates');
add('V114 FanDuel pulse certification',read('src/lib/providerCertification.ts').includes("providerId:'fanlinewire-fanduel-pulse'")&&read('src/app/api/live-data/status/route.ts').includes("effectiveSource=ingestion.source==='unavailable'&&pulseUsable?'pulse':ingestion.source"),'fresh real FanDuel pulse can provide quota continuity when full normalized and persisted odds are unavailable');
add('V114 pulse observability continuity',read('src/lib/productionObservability.ts').includes('pulseUsable')&&read('src/lib/productionObservability.ts').includes("state='DEGRADED'")&&read('src/lib/productionObservability.ts').includes('never to HEALTHY'),'pulse continuity may downgrade stale market freshness from critical to degraded but never claim healthy full coverage');
add('V114 conditional V1 continuity',read('src/lib/v1ReleaseReadiness.ts').includes('pulseContinuity&&remediationMode')&&read('src/lib/v1ReleaseReadiness.ts').includes('full normalized sportsbook recommendations remain protected'),'pulse-only remediation is CONDITIONAL and protected rather than represented as fully healthy live data');
add('V114 health capability',read('src/app/api/health/route.ts').includes('stagedRemediationPromotion:true')&&read('src/app/api/health/route.ts').includes('exactCloudflareIdentityConvergence:true'),'health exposes V114 remediation continuity capabilities');
add('V114 release notes',exists('EDGEFORCE_V114_RELEASE.md'),'V114 release documentation exists');
add('V119 production build fidelity',read('.github/workflows/deploy-production.yml').includes('Build staged production artifact')&&read('.github/workflows/deploy-production.yml').includes('build --prod')&&read('.github/workflows/deploy-production.yml').includes('pull --yes --environment=production')&&String(pkg.scripts.posttypecheck).includes('tests/production-target.test.mjs'),'candidate uses production settings and mandatory alias/environment regression coverage');
add('V115 prediction prime diagnostics',read('.github/workflows/deploy-cloudflare.yml').includes('Prediction warehouse prime returned HTTP')&&read('.github/workflows/deploy-cloudflare.yml').includes('/tmp/prediction-warehouse.json'),'Cloudflare preserves prediction warehouse failure evidence instead of hiding the response body');
add('V115 fail-soft prediction warehouse',read('src/app/api/cron/predictions/route.ts').includes('const degraded=warnings.length>0')&&read('src/app/api/cron/predictions/route.ts').includes('Prediction market persistence:')&&read('src/app/api/cron/predictions/route.ts').includes('warnings:[...new Set'),'prediction-market auxiliary source and persistence failures are reported as degraded instead of converting all partial success to HTTP 500');
add('V115 health capability',read('src/app/api/health/route.ts').includes('releasePathConvergence:true'),'health exposes release-path convergence');
add('V115 release notes',exists('EDGEFORCE_V115_RELEASE.md'),'V115 release documentation exists');
add('V116 schema-based hosted smoke',read('scripts/remote-smoke.mjs').includes("json.schemaVersion==='v61-expert-models-1'")&&!read('scripts/remote-smoke.mjs').includes("json.ok!==true||json.build!=='V61'||json.schemaVersion!=='v61-expert-models-1'"),'hosted smoke validates the expert-model feature schema while release identity remains owned by health endpoints');
add('V116 pulse-aware strict readiness',read('src/lib/readiness.ts').includes('pulseUsable')&&read('src/lib/readiness.ts').includes('fresh FanDuel pulse continuity'),'strict readiness recognizes fresh real pulse continuity when normalized providers are quarantined');
add('V116 legacy snapshot provider repair',read('scripts/migrate.mjs').includes("column_name='provider'")&&read('scripts/migrate.mjs').includes('alter column provider drop not null'),'legacy prediction snapshot provider constraint no longer blocks canonical venue-based inserts');
add('V116 health capability',read('src/app/api/health/route.ts').includes('runtimeContractConvergence:true'),'health exposes runtime contract convergence');
add('V116 release notes',exists('EDGEFORCE_V116_RELEASE.md'),'V116 release documentation exists');
add('V117 procedural-SQL-free snapshot repair',read('scripts/migrate.mjs').includes('legacyProviderColumn')&&read('scripts/migrate.mjs').includes('alter column provider drop not null'),'legacy prediction snapshot provider repair uses application-side schema detection instead of fragile procedural SQL');
add('V117 degraded expert-model smoke',read('scripts/remote-smoke.mjs').includes('degradedAllowedPaths')&&read('scripts/remote-smoke.mjs').includes('degradedValid')&&read('scripts/remote-smoke.mjs').includes('No live or fresh stored sportsbook markets'),'hosted smoke accepts the explicit degraded expert-model contract while still validating its schema and catalog');
add('V117 pulse-only downstream contracts',read('src/app/api/live-comeback/route.ts').includes('degraded:true')&&read('src/app/api/intelligence/context/route.ts').includes('v51-context-intelligence-1')&&read('src/app/api/parlays/route.ts').includes('degraded:true')&&read('scripts/remote-smoke.mjs').includes("'/api/live-comeback'")&&read('scripts/remote-smoke.mjs').includes("'/api/intelligence/context'")&&read('scripts/remote-smoke.mjs').includes("'/api/parlays?size=2&view=today'"),'pulse-only continuity returns explicit degraded contracts for downstream recommendation/context features rather than appearing broken');
add('V117 health capability',read('src/app/api/health/route.ts').includes('degradedRuntimeCertification:true'),'health exposes degraded runtime certification');
add('V117 release notes',exists('EDGEFORCE_V117_RELEASE.md'),'V117 release documentation exists');
add('V119 bounded Cloudflare prediction automation',read('src/app/api/cron/predictions/route.ts').includes("cloudflareBounded=platform==='cloudflare'")&&read('src/app/api/cron/predictions/route.ts').includes('executionProfile')&&read('src/app/api/cron/predictions/route.ts').includes('fetchPredictionMarkets({maxContracts:contractLimit})'),'Cloudflare prediction automation uses an explicit bounded execution profile');
add('V119 bounded Kalshi fetch',read('src/lib/providers/kalshi.ts').includes('KALSHI_MARKET_PAGE_LIMIT'),'Kalshi public-market ingestion accepts a runtime page-size ceiling');
add('V119 bounded prediction market collection',read('src/lib/predictionMarkets.ts').includes('options?:{maxContracts?:number}')&&read('src/lib/predictionMarkets.ts').includes('options?.maxContracts??configuredMaxContracts'),'prediction market collection supports a request-specific bounded contract ceiling');
add('V119 Worker resource profile',read('wrangler.jsonc').includes('"PREDICTION_MARKET_MAX_CONTRACTS": "300"')&&read('wrangler.jsonc').includes('"PREDICTION_CRON_TRADE_LIMIT": "100"')&&read('wrangler.jsonc').includes('"PREDICTION_CRON_LEADERBOARD_LIMIT": "25"')&&read('wrangler.jsonc').includes('"KALSHI_MARKET_PAGE_LIMIT": "150"')&&read('wrangler.jsonc').includes('limit=150'),'Cloudflare runtime constrains contract, trade, and leaderboard batch sizes');
add('V119 health capability',read('src/app/api/health/route.ts').includes('cloudflareBoundedPredictionPrime:true')&&read('src/app/api/health/route.ts').includes('workerSafePredictionAutomation:true'),'health exposes Worker-safe prediction automation');
add('V119 observability timestamp compatibility',read('src/lib/productionObservability.ts').includes('information_schema.columns')&&read('src/lib/productionObservability.ts').includes("latestTimestamp('market_snapshots'")&&read('src/lib/productionObservability.ts').includes("latestTimestamp('market_consensus_snapshots'"),'production observability resolves legacy snapshot timestamp columns without collapsing database health');
add('V119 quota remediation certification',read('src/lib/productionCertification.ts').includes('continuityAutomationFailures')&&read('src/lib/productionCertification.ts').includes('known quota-continuity remediation dependency'),'strict remediation certification tolerates only explicitly recognized quota-continuity automation dependencies');
add('V119 inherited-state comparative canary',read('src/lib/deploymentGuard.ts').includes('inheritedCriticalContinuity')&&read('src/lib/deploymentGuard.ts').includes('inheritedProtectiveContinuity')&&read('src/lib/deploymentGuard.ts').includes('pulseUsable'),'comparative canary permits inherited non-regressing protective state only with fresh real pulse continuity');
add('V119 strict certification payload gate',read('.github/workflows/deploy-production.yml').includes("jq -e '.certified==true and (.blockers|length)==0'"),'production workflow verifies certification payload before advancing');
add('V119 remediation health capability',read('src/app/api/health/route.ts').includes('legacyObservabilityTimestampRepair:true')&&read('src/app/api/health/route.ts').includes('remediationCanaryContinuity:true')&&read('src/app/api/health/route.ts').includes('strictCertificationPayloadGate:true'),'health exposes Vercel remediation hardening');
add('V119 certified pulse launch continuity',read('src/app/api/launch-doctor/route.ts').includes('currentPulseCertification')&&read('src/app/api/launch-doctor/route.ts').includes('pulseCertificationAgeMs<=2*60*1000')&&read('src/app/api/launch-doctor/route.ts').includes('onlyTransientPulseFailure'),'launch doctor may bridge only an oddsProvider recheck miss with a fresh current-release certified FanDuel pulse');
add('V119 health capability',read('src/app/api/health/route.ts').includes('launchDoctorCertifiedPulseContinuity:true')&&read('src/app/api/health/route.ts').includes('productionGateBooleanCorrectness:true'),'health exposes production gate correctness');
add('V119 canary boolean correctness',read('.github/workflows/deploy-production.yml').includes('if has("hardBlock") then .hardBlock else true end'),'comparative canary preserves an explicit hardBlock false result instead of treating false as missing');
add('V119 observable launch doctor retry',read('.github/workflows/deploy-cloudflare.yml').includes('/tmp/launch-doctor.json')&&read('.github/workflows/deploy-cloudflare.yml').includes('PASSES')&&read('.github/workflows/deploy-cloudflare.yml').includes('119.0.0'),'Cloudflare launch doctor preserves response evidence and requires repeated current-release readiness');
add('V119 release notes',exists('EDGEFORCE_V119_RELEASE.md'),'V119 release documentation exists');
add('V131 certification identity restore',read('src/lib/providerCertification.ts').includes('extractProviderCertificationCommit(row.warnings)')&&read('src/lib/providerCertification.ts').includes('warnings:visibleProviderCertificationWarnings(row.warnings)'),'persisted provider certification restores exact deployment identity and hides internal commit marker warnings');
add('V131 canonical Vercel target',read('.github/workflows/hourly-ops.yml').includes('https://edgeforce-ai.vercel.app')&&!read('.github/workflows/hourly-ops.yml').includes('https://edgeforce-ai2.vercel.app')&&!read('vercel.json').includes('prj_8edFTZzS8e6RZyMVm1mjxuGJnLPZ'),'hourly operations and Vercel configuration no longer target legacy edgeforce-ai2');
add('V131 production workflow action pins',read('.github/workflows/deploy-production.yml').includes('actions/checkout@11d5960a326750d5838078e36cf38b85af677262')&&read('.github/workflows/deploy-production.yml').includes('actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020'),'production deployment actions are pinned to reviewed immutable commits');
add('V132 exact provider certification scope',read('src/lib/productionCertification.ts').includes('providerCertificationRuntimeCommit()')&&read('src/lib/productionCertification.ts').includes('latestProviderCertification(deploymentCommit||undefined)'),'strict production certification consumes only exact-deployment provider evidence');
add('V132 bounded remediation continuity',read('src/lib/productionCertification.ts').includes('normalizedOddsCertified')&&read('src/lib/productionCertification.ts').includes('storedRemediationContinuity')&&read('src/lib/productionCertification.ts').includes('comparative canary must prove no regression before promotion'),'a remediation candidate may inherit protected operational failures only with exact normalized odds evidence and a non-rejected stored slate before comparative canary');
add('V132 remediation regression test',exists('tests/production-certification-remediation.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/production-certification-remediation.test.mjs'),'remediation continuity invariants are mandatory in posttypecheck');
add('V133 Vercel verification retry hardening',read('.github/workflows/deploy-production.yml').includes('--retry 3 --retry-all-errors --retry-delay 2 --retry-max-time 120')&&read('tests/production-target.test.mjs').includes('identity-critical Vercel API reads use bounded retries'),'read-only deployment and alias identity checks tolerate bounded transient Vercel API transport failures without retrying release mutations');
add('V134 legacy remediation handoff',read('.github/workflows/deploy-production.yml').includes('Pre-V74 production lacks modern SLO evidence.')&&read('.github/workflows/deploy-production.yml').includes('EDGEFORCE_REMEDIATION_DEPLOY=true')&&read('tests/production-target.test.mjs').includes('healthy pre-V74 production stages the replacement as remediation'),'healthy legacy production replacements enter bounded remediation mode while strict certification, SLO, canary, and V1 gates remain mandatory');
add('V135 strict-certified legacy SLO handoff',read('scripts/release-gate.mjs').includes('legacyHandoff && strictCertified')&&read('.github/workflows/deploy-production.yml').includes('EDGEFORCE_LEGACY_REMEDIATION_HANDOFF=true')&&read('.github/workflows/deploy-production.yml').includes('EDGEFORCE_STRICT_CERTIFIED=true'),'only a verified pre-V74 handoff whose exact candidate already passed strict certification may advance a shared-history CRITICAL SLO freeze to comparative canary');
add('V135 ordinary CRITICAL remediation remains fail-closed',exists('tests/release-gate-slo-remediation.test.mjs')&&read('tests/release-gate-slo-remediation.test.mjs').includes('ordinary remediation still fails closed on current CRITICAL health')&&String(pkg.scripts.posttypecheck).includes('tests/release-gate-slo-remediation.test.mjs'),'legacy SLO exception cannot be used by normal remediation deployments');
add('V135 release notes',exists('EDGEFORCE_V135_RELEASE.md'),'V135 release documentation exists');
add('V136 explicit legacy telemetry absence',read('.github/workflows/deploy-production.yml').includes('LEGACY_TELEMETRY_UNAVAILABLE=true')&&read('.github/workflows/deploy-production.yml').includes('legacyTelemetryUnavailable:($legacyTelemetryUnavailable=="true")')&&read('src/lib/deploymentGuard.ts').includes('baseline.legacyTelemetryUnavailable===true'),'pre-V74 canary baselines distinguish unavailable modern telemetry from healthy zero values');
add('V136 bounded legacy canary handoff',read('src/lib/deploymentGuard.ts').includes('legacyCriticalContinuity')&&read('src/lib/deploymentGuard.ts').includes('legacyProtectiveContinuity')&&read('src/app/api/release/deployment-guard/route.ts').includes('legacyHandoff:body.legacyHandoff===true'),'legacy canary continuity requires an explicit workflow handoff plus current candidate readiness, certification and fresh pulse');
add('V136 modern canary fail-closed regression',exists('tests/deployment-guard-legacy-handoff.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/deployment-guard-legacy-handoff.test.mjs'),'modern baselines retain incident, automation, observability and reliability regression gates');
add('V136 release notes',exists('EDGEFORCE_V136_RELEASE.md'),'V136 release documentation exists');
add('V137 team-wide Vercel deployment budget',read('.github/workflows/deploy-production.yml').includes('api.vercel.com/v6/deployments?teamId=$VERCEL_ORG_ID&limit=100')&&!read('.github/workflows/deploy-production.yml').includes('v6/deployments?projectId=$VERCEL_PROJECT_ID&teamId=$VERCEL_ORG_ID&limit=100'),'Vercel deployment budget preflight counts shared team usage instead of only the Edgeforce project');
add('V137 budget scope regression',read('tests/vercel-deployment-budget.test.mjs').includes('team-wide trailing 24h usage')&&read('tests/vercel-deployment-budget.test.mjs').includes('assert.doesNotMatch(guard,/projectId='),'tests prevent project-scoped budget counting from returning');
add('V137 release notes',exists('EDGEFORCE_V137_RELEASE.md'),'V137 release documentation exists');
add('V138 early budget deferral',read('.github/workflows/deploy-production.yml').includes('budget-preflight:')&&read('.github/workflows/deploy-production.yml').includes("needs: budget-preflight")&&read('.github/workflows/deploy-production.yml').includes("if: needs.budget-preflight.outputs.allowed == 'true'")&&read('.github/workflows/deploy-production.yml').includes('Deferring production before checkout, install, test, build, or upload'),'shared Vercel capacity is checked before expensive production validation and upload work');
add('V138 bounded budget retry',exists('.github/workflows/team-vercel-governor.yml')&&read('.github/workflows/team-vercel-governor.yml').includes('actions/workflows/deploy-production.yml/dispatches')&&read('.github/workflows/team-vercel-governor.yml').includes('ACTIVE_COUNT'),'V138 retry semantics are preserved by the V139 team governor: production dispatch remains bounded by active-release and capacity checks');
add('V138 Git deployment suppression',vercel.git?.deploymentEnabled===false,'Vercel Git auto-deploy remains disabled so the guarded CLI workflow owns the canonical release path');
add('V138 release notes',exists('EDGEFORCE_V138_RELEASE.md'),'V138 release documentation exists');
add('V139 shared team deployment budget',exists('config/vercel-team-governor.json')&&read('config/vercel-team-governor.json').includes('"softCap": 84')&&read('config/vercel-team-governor.json').includes('"hardCap": 90')&&read('config/vercel-team-governor.json').includes('"emergencyReserve": 6'),'normal automation stops before six reserved emergency slots');
add('V139 deployment coalescing',exists('scripts/team-vercel-governor.mjs')&&read('scripts/team-vercel-governor.mjs').includes('minProjectIntervalMs')&&read('scripts/team-vercel-governor.mjs').includes('oldest')===false&&read('scripts/team-vercel-governor.mjs').includes('lastDeploymentAt'),'shared planner applies cooldown and oldest-pending fairness instead of per-commit release amplification');
add('V139 central team governor workflow',exists('.github/workflows/team-vercel-governor.yml')&&read('.github/workflows/team-vercel-governor.yml').includes("cron: '17 * * * *'")&&read('.github/workflows/team-vercel-governor.yml').includes('v1/integrations/search-repo?provider=github')&&read('.github/workflows/team-vercel-governor.yml').includes('v13/deployments?teamId=$TEAM_ID&forceNew=0'),'one hourly controller owns normal team deployment pressure');
add('V139 preserves Edgeforce certification path',read('.github/workflows/team-vercel-governor.yml').includes('actions/workflows/deploy-production.yml/dispatches')&&!read('.github/workflows/team-vercel-governor.yml').includes('gitSource:{type:"github",repoId:$repoId,ref:"main",sha:$GITHUB_SHA}'),'Edgeforce is dispatched through its guarded production workflow rather than deployed raw');
add('V139 supersedes independent retry',!exists('.github/workflows/retry-production-on-budget.yml'),'the Edgeforce-only hourly retry is retired so scheduling has a single authority');
add('V139 mandatory governor regression',exists('tests/team-vercel-governor.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/team-vercel-governor.test.mjs'),'team deployment governor tests are mandatory');
add('V139 release notes',exists('EDGEFORCE_V139_RELEASE.md'),'V139 release documentation exists');
add('V140 governor telemetry schema',read('db/v115.sql').includes('vercel_governor_snapshots')&&read('db/v115.sql').includes('next_normal_slot_at')&&read('db/v115.sql').includes('project_states jsonb'),'v115 stores governor capacity and project-state snapshots');
add('V140 live team telemetry',read('src/lib/vercelGovernorTelemetry.ts').includes("import 'server-only'")&&read('src/lib/vercelGovernorTelemetry.ts').includes('VERCEL_TOKEN')&&read('src/lib/vercelGovernorTelemetry.ts').includes("since:String(cutoff)")&&read('src/lib/vercelGovernorTelemetry.ts').includes("params.set('until'"),'server-only telemetry pages the rolling team deployment window without exposing credentials');
add('V140 recovery forecast',read('src/lib/vercelGovernorTelemetry.ts').includes('usage-softCap+1')&&read('src/lib/vercelGovernorTelemetry.ts').includes('recent[slotsToRecover-1]')&&read('src/lib/vercelGovernorTelemetry.ts').includes('overHardCap=Math.max(0,usage-hardCap)'),'telemetry predicts when enough deployments age out for normal capacity to resume');
add('V140 project governor states',read('src/lib/vercelGovernorTelemetry.ts').includes("'CURRENT'|'ACTIVE'|'APPROVED'|'DEFERRED'")&&read('src/lib/vercelGovernorTelemetry.ts').includes('project cooldown has not expired')&&read('src/lib/vercelGovernorTelemetry.ts').includes('team normal deployment budget is exhausted'),'project status explains current, active, approved, and deferred release states');
add('V140 throttled durable history',read('src/lib/vercelGovernorTelemetry.ts').includes('15*60*1000')&&read('src/lib/vercelGovernorTelemetry.ts').includes('insert into vercel_governor_snapshots')&&read('src/lib/vercelGovernorTelemetry.ts').includes('recentVercelGovernorSnapshots'),'governor history is persisted without writing on every dashboard poll');
add('V140 sanitized telemetry API',read('src/app/api/operations/vercel-governor/route.ts').includes('x-edgeforce-governor-telemetry')&&!read('src/components/VercelGovernorPanel.tsx').includes('VERCEL_TOKEN'),'browser receives sanitized governor telemetry, not the Vercel credential');
add('V140 governor dashboard',read('src/components/Dashboard.tsx').includes('VercelGovernorPanel')&&read('src/components/VercelGovernorPanel.tsx').includes('SLOTS TO RECOVER')&&read('src/components/VercelGovernorPanel.tsx').includes('NEXT NORMAL SLOT'),'main dashboard shows capacity, project accounting and recovery forecast');
add('V140 health capability',read('src/app/api/health/route.ts').includes('vercelTeamGovernorTelemetry:true')&&read('scripts/smoke.mjs').includes('Vercel team governor telemetry flag missing'),'health and smoke contracts advertise governor telemetry');
add('V140 mandatory regression',exists('tests/vercel-governor-telemetry.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/vercel-governor-telemetry.test.mjs'),'governor telemetry contracts are mandatory in typecheck verification');
add('V140 release notes',exists('EDGEFORCE_V140_RELEASE.md'),'V140 release documentation exists');
add('V141 governor decision schema',read('db/v116.sql').includes('vercel_governor_decisions')&&read('db/v116.sql').includes('snapshot_id bigint references vercel_governor_snapshots')&&read('db/v116.sql').includes('vercel_governor_alerts'),'v116 stores per-snapshot decisions and durable recovery alerts');
add('V141 recovery timeline',read('src/lib/vercelGovernorTelemetry.ts').includes('buildRecoveryTimeline')&&read('src/lib/vercelGovernorTelemetry.ts').includes("'HARD_CAP_CLEAR'")&&read('src/lib/vercelGovernorTelemetry.ts').includes("'NORMAL_CAPACITY'"),'telemetry exposes exact hard-cap and normal-capacity recovery milestones');
add('V141 alert synchronization',read('src/lib/vercelGovernorTelemetry.ts').includes('syncVercelGovernorAlerts')&&read('src/lib/vercelGovernorTelemetry.ts').includes('on conflict (alert_key) do update')&&read('src/lib/vercelGovernorTelemetry.ts').includes('resolved_at=coalesce(resolved_at,now())'),'capacity and project alerts are durable, de-duplicated, and resolvable');
add('V141 decision history',read('src/lib/vercelGovernorTelemetry.ts').includes('recordVercelGovernorDecisions')&&read('src/lib/vercelGovernorTelemetry.ts').includes('recentVercelGovernorDecisions'),'each persisted governor snapshot records per-project release decisions');
add('V141 manual release hard cap',exists('.github/workflows/team-vercel-manual-release.yml')&&read('.github/workflows/team-vercel-manual-release.yml').includes('NORMAL_CAP: "84"')&&read('.github/workflows/team-vercel-manual-release.yml').includes('HARD_CAP: "90"')&&read('.github/workflows/team-vercel-manual-release.yml').includes('Hard-cap bypass: **not permitted**'),'manual release workflow cannot bypass the 90-deployment safety cap');
add('V141 emergency reserve gating',read('.github/workflows/team-vercel-manual-release.yml').includes('RELEASE_TIER')&&read('.github/workflows/team-vercel-manual-release.yml').includes('Emergency tier is unnecessary while normal capacity is available'),'emergency releases are restricted to the reserve band between normal and hard caps');
add('V141 manual input hardening',read('.github/workflows/team-vercel-manual-release.yml').includes('RELEASE_JUSTIFICATION: ${{ inputs.justification }}')&&read('.github/workflows/team-vercel-manual-release.yml').includes('--arg justification "$RELEASE_JUSTIFICATION"')&&!read('.github/workflows/team-vercel-manual-release.yml').includes("--arg justification '${{ inputs.justification }}'"),'free-text justification reaches shell commands only through an environment variable');
add('V141 guarded Edgeforce manual path',read('.github/workflows/team-vercel-manual-release.yml').includes('actions/workflows/deploy-production.yml/dispatches')&&!read('.github/workflows/team-vercel-manual-release.yml').includes('--force'),'manual Edgeforce releases reuse the hardened production workflow and never force deployment');
add('V141 read-only browser control',read('src/app/api/operations/vercel-governor/route.ts').includes('publicBrowserReadOnly:true')&&!read('src/app/api/operations/vercel-governor/route.ts').includes('export async function POST')&&read('src/components/VercelGovernorPanel.tsx').includes('OPEN REVIEWED MANUAL RELEASE'),'public dashboard exposes status and a reviewed workflow link, not a direct production action');
add('V141 health capability',read('src/app/api/health/route.ts').includes('vercelGovernorRecoveryControls:true')&&read('scripts/smoke.mjs').includes('Vercel governor recovery controls flag missing'),'health and smoke contracts advertise V141 recovery controls');
add('V141 mandatory regression',exists('tests/vercel-governor-recovery.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/vercel-governor-recovery.test.mjs'),'V141 recovery and manual-release contracts are mandatory');
add('V141 exact scheduled budget accounting',read('.github/workflows/team-vercel-governor.yml').includes('Capture exact team deployment usage')&&read('.github/workflows/team-vercel-governor.yml').includes('until=$UNTIL')&&read('.github/workflows/team-vercel-governor.yml').includes('unique_by(.id)'),'hourly governor pages the complete trailing deployment window instead of truncating at 100');
add('V141 scheduled capacity alerts',read('.github/workflows/team-vercel-governor.yml').includes('Vercel normal capacity available')&&read('.github/workflows/team-vercel-governor.yml').includes('Vercel emergency reserve active')&&read('.github/workflows/team-vercel-governor.yml').includes('Vercel hard-cap block active'),'hourly governor publishes capacity-state annotations from exact usage');
add('V141 release notes',exists('EDGEFORCE_V141_RELEASE.md'),'V141 release documentation exists');
add('V142 exact project share partition',read('config/vercel-team-governor.json').includes('"normalBudgetShare": 34')&&read('config/vercel-team-governor.json').includes('"normalBudgetShare": 28')&&read('config/vercel-team-governor.json').includes('"normalBudgetShare": 22'),'Edgeforce, Safeguard and TravAI shares exactly partition the 84 normal slots');
add('V142 fairness scoring',read('scripts/team-vercel-governor.mjs').includes('agingScore')&&read('scripts/team-vercel-governor.mjs').includes('underBudgetScore')&&read('scripts/team-vercel-governor.mjs').includes('overBudgetPenalty')&&read('scripts/team-vercel-governor.mjs').includes('fairnessScore'),'allocator combines project priority, waiting age, under-share credit and over-share penalty');
add('V142 under-share queue precedence',read('scripts/team-vercel-governor.mjs').includes('const ranked=[...underShare,...overShare]')&&read('scripts/team-vercel-governor.mjs').includes('maxBorrowedActionsPerRun'),'under-share demand is served before bounded borrowed normal capacity');
add('V142 automatic reserve isolation',read('scripts/team-vercel-governor.mjs').includes('if(usage<softCap&&slots>0)')&&read('.github/workflows/team-vercel-manual-release.yml').includes('HARD_CAP: "90"'),'automatic allocation remains below 84 while emergency reserve stays manual and hard-capped');
add('V142 allocation evidence metadata',read('.github/workflows/team-vercel-governor.yml').includes('governorQueueRank')&&read('.github/workflows/team-vercel-governor.yml').includes('governorFairnessScore')&&read('.github/workflows/team-vercel-governor.yml').includes('deploymentGovernor:"edgeforce-v142"'),'peer deployments carry queue and fairness evidence from the allocator');
add('V142 durable allocation history',read('db/v117.sql').includes('queue_rank int')&&read('db/v117.sql').includes('fairness_score numeric')&&read('db/v117.sql').includes('normal_budget_share int')&&read('db/v117.sql').includes('borrowed_capacity boolean'),'v117 persists queue rank, fairness, share usage and borrowed-capacity evidence');
add('V142 live fair-share telemetry',read('src/lib/vercelGovernorTelemetry.ts').includes('normalBudgetShare')&&read('src/lib/vercelGovernorTelemetry.ts').includes('queueRank')&&read('src/lib/vercelGovernorTelemetry.ts').includes('fairnessScore'),'server telemetry exposes the same fair-share state used by the allocator');
add('V142 dashboard queue evidence',read('src/components/VercelGovernorPanel.tsx').includes('VERCEL TEAM GOVERNOR')&&read('src/components/VercelGovernorPanel.tsx').includes('BORROWED')&&read('src/components/VercelGovernorPanel.tsx').includes('fairnessScore'),'dashboard shows queue rank, score, share state and borrowed capacity');
add('V142 health capability',read('src/app/api/health/route.ts').includes('vercelGovernorFairShareAllocation:true')&&read('scripts/smoke.mjs').includes('Vercel governor fair-share allocation flag missing'),'health and smoke contracts advertise fair-share allocation');
add('V142 mandatory fair-share regression',exists('tests/vercel-governor-fairness.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/vercel-governor-fairness.test.mjs'),'V142 queue and allocation evidence tests are mandatory');
add('V142 release notes',exists('EDGEFORCE_V142_RELEASE.md'),'V142 release documentation exists');
add('V143 exact-main Cloudflare certification',read('.github/workflows/verify-cloudflare.yml').includes('push:')&&read('.github/workflows/verify-cloudflare.yml').includes('branches: [main]'),'squash-merge main SHAs receive exact Cloudflare verification instead of relying only on PR evidence');
add('V143 certified backlog evaluator',exists('scripts/edgeforce-release-backlog.mjs')&&read('scripts/edgeforce-release-backlog.mjs').includes("'Verify Edgeforce'")&&read('scripts/edgeforce-release-backlog.mjs').includes("'Verify Edgeforce Cloudflare'")&&read('scripts/edgeforce-release-backlog.mjs').includes('headCertified'),'release backlog requires both exact-main verification workflows');
add('V143 fail-closed truncated backlog',read('scripts/edgeforce-release-backlog.mjs').includes('truncated')&&read('scripts/edgeforce-release-backlog.mjs').includes('!truncated&&headCertified'),'catch-up cannot proceed when compare evidence is incomplete');
add('V143 governor backlog capture',read('.github/workflows/team-vercel-governor.yml').includes('Capture Edgeforce certified release backlog')&&read('.github/workflows/team-vercel-governor.yml').includes('compare/$LIVE_SHA...$HEAD_SHA?per_page=100')&&read('.github/workflows/team-vercel-governor.yml').includes('actions/runs?branch=main&per_page=100'),'hourly governor resolves production-to-main backlog and exact-main workflow evidence');
add('V143 allocator certification gate',read('scripts/team-vercel-governor.mjs').includes('certificationReady')&&read('scripts/team-vercel-governor.mjs').includes('current main SHA has not completed exact-main certification'),'Edgeforce cannot enter the V142 fair-share queue until exact main is certified');
add('V143 durable backlog history',read('db/v118.sql').includes('edgeforce_release_backlog_snapshots')&&read('db/v118.sql').includes('newest_certified_sha text')&&read('db/v118.sql').includes('catch_up_eligible boolean'),'v118 stores release lag and catch-up eligibility history');
add('V143 live backlog telemetry',exists('src/lib/edgeforceReleaseBacklog.ts')&&read('src/lib/edgeforceReleaseBacklog.ts').includes('getEdgeforceReleaseBacklog')&&read('src/lib/edgeforceReleaseBacklog.ts').includes('persistEdgeforceReleaseBacklog'),'operations API can independently verify and persist release backlog state');
add('V143 read-only backlog dashboard',read('src/app/api/operations/vercel-governor/route.ts').includes('backlogHistory')&&!read('src/app/api/operations/vercel-governor/route.ts').includes('export async function POST')&&read('src/components/VercelGovernorPanel.tsx').includes('Certified release backlog')&&read('src/components/VercelGovernorPanel.tsx').includes('Safe catch-up'),'dashboard exposes backlog status without direct release mutation');
add('V143 health capability',read('src/app/api/health/route.ts').includes('certifiedReleaseBacklog:true')&&read('scripts/smoke.mjs').includes('Certified release backlog flag missing'),'health and smoke contracts advertise certified backlog control');
add('V143 mandatory backlog regression',exists('tests/edgeforce-release-backlog.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/edgeforce-release-backlog.test.mjs'),'exact-main certification and catch-up tests are mandatory');
add('V143 release notes',exists('EDGEFORCE_V143_RELEASE.md'),'V143 release documentation exists');
add('V144 Cloudflare exact-main dual certification',read('.github/workflows/deploy-cloudflare.yml').includes('Require both exact-main certification workflows')&&read('.github/workflows/deploy-cloudflare.yml').includes('Verify Edgeforce Cloudflare')&&read('.github/workflows/deploy-cloudflare.yml').includes('head_sha=$DEPLOY_COMMIT'),'Cloudflare production waits for both exact-main verification workflows');
add('V144 Cloudflare platform readiness split',read('.github/workflows/deploy-cloudflare.yml').includes('Certify recommendation data without blocking platform launch')&&read('.github/workflows/deploy-cloudflare.yml').includes('launch-doctor?strict=1&platform=1')&&read('src/app/api/launch-doctor/route.ts').includes('recommendationReady')&&read('src/app/api/launch-doctor/route.ts').includes('platformReady'),'temporary sportsbook quota exhaustion cannot take the platform offline while recommendations remain fail-closed');
add('V144 Vercel manual standby trigger',read('.github/workflows/deploy-production.yml').includes('on:\n  workflow_dispatch:')&&!read('.github/workflows/deploy-production.yml').includes('push:\n    branches: [main]'),'Edgeforce Vercel production has no automatic main push trigger');
add('V144 governor standby exclusion',read('config/vercel-team-governor.json').includes('"autoRelease": false')&&read('config/vercel-team-governor.json').includes('"standbyRole": "manual-disaster-recovery"')&&read('scripts/team-vercel-governor.mjs').includes('project.autoRelease!==false'),'team governor cannot automatically consume a Vercel slot for Edgeforce');
add('V144 optional provider secrets',read('scripts/cloudflare-runtime-secrets.mjs').includes("const required=['DATABASE_URL','INGEST_SECRET','CRON_SECRET']")&&read('scripts/cloudflare-runtime-secrets.mjs').includes('FOOTBALL_DATA_API_KEY')&&read('scripts/cloudflare-runtime-secrets.mjs').includes('API_SPORTS_KEY')&&read('scripts/cloudflare-runtime-secrets.mjs').includes('BIGBALLS_API_KEY'),'sportsbook and community provider credentials are optional Cloudflare secrets');
add('V144 free-first score mesh',exists('src/lib/providers/communityScoreBackups.ts')&&read('src/lib/liveScoreMesh.ts').includes('fetchCommunityScoreBackups')&&read('wrangler.jsonc').includes('SPORTSCORE_ENABLED')&&read('wrangler.jsonc').includes('THESPORTSDB_ENABLED'),'Cloudflare score mesh fuses keyless and optional free community sources');
add('V144 provider quota-conscious caching',read('src/lib/providers/communityScoreBackups.ts').includes("cached('thesportsdb',10*60_000")&&read('src/lib/providers/communityScoreBackups.ts').includes("cached('bigballs',6*60_000")&&read('src/lib/providers/communityScoreBackups.ts').includes("cached('api-sports',15*60_000"),'community score sources use bounded cache intervals suited to free quotas');
add('V144 health capability',read('src/app/api/health/route.ts').includes('cloudflarePrimaryProduction:true')&&read('src/app/api/health/route.ts').includes('vercelManualStandby:true')&&read('src/app/api/health/route.ts').includes('freeFirstSportsDataMesh:true')&&read('scripts/smoke.mjs').includes('Cloudflare primary production flag missing'),'health and smoke contracts advertise V144 topology');
add('V144 mandatory regressions',exists('tests/community-score-backups.test.mjs')&&exists('tests/cloudflare-primary-standby.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/community-score-backups.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/cloudflare-primary-standby.test.mjs'),'free mesh and primary/standby contracts are mandatory');
add('V144 release notes',exists('EDGEFORCE_V144_RELEASE.md'),'V144 release documentation exists');
add('V145 primary standby topology semantics',read('src/lib/releasePlatformConvergence.ts').includes('cloudflare-primary-vercel-standby')&&read('src/lib/releasePlatformConvergence.ts').includes('Vercel standby deployment is not READY')&&read('src/lib/releasePlatformConvergence.ts').includes('commitDrift:Boolean'),'platform evidence certifies a current Cloudflare primary and healthy manual Vercel standby while recording drift');
add('V145 standby non-deploying verification',read('.github/workflows/deploy-cloudflare.yml').includes('Verify Vercel manual standby without deploying')&&read('.github/workflows/deploy-cloudflare.yml').includes('api.vercel.com/v4/aliases/$VERCEL_PRODUCTION_ALIAS')&&read('.github/workflows/deploy-cloudflare.yml').includes('api.vercel.com/v13/deployments/$STANDBY_ID')&&!read('.github/workflows/deploy-cloudflare.yml').includes('vercel deploy --prod'),'Cloudflare release verifies the existing Vercel standby without creating another deployment');
add('V145 topology evidence writer',read('.github/workflows/deploy-cloudflare.yml').includes('topology:"cloudflare-primary-vercel-standby"')&&read('.github/workflows/deploy-cloudflare.yml').includes('exactMainCertified:true')&&read('.github/workflows/deploy-cloudflare.yml').includes('hostedSmokePassed:true')&&read('.github/workflows/deploy-cloudflare.yml').includes('platformReady:true'),'Cloudflare production records exact-main, hosted smoke, platform readiness, and standby evidence together');
add('V145 topology-aware final closure',read('src/lib/finalProductionClosure.ts').includes("topologyEvidence?.topology==='cloudflare-primary-vercel-standby'")&&read('src/lib/finalProductionClosure.ts').includes('standby.healthy===true')&&read('src/lib/finalProductionClosure.ts').includes('standby.manualOnly===true')&&read('src/lib/finalProductionClosure.ts').includes("String(standby.state||'').toUpperCase()==='READY'"),'final closure is based on primary certification plus healthy standby rather than same-commit dual-active convergence');
add('V145 standby drift is non-blocking',read('src/lib/finalProductionClosure.ts').includes('standbyCommitDrift:Boolean')&&read('src/app/api/testing/platform-convergence/route.ts').includes('standbyCommitDriftAllowed')&&read('src/app/api/testing/final-closure/route.ts').includes('standbyDriftAllowed'),'standby commit drift is persisted as evidence and explicitly allowed');
add('V145 operator topology surface',read('src/components/PlatformConvergencePanel.tsx').includes('Cloudflare Production + Vercel Disaster Recovery')&&read('src/components/FinalProductionClosurePanel.tsx').includes('Primary / Standby Release Certificate'),'operator panels describe the primary/standby topology instead of same-commit dual-platform operation');
add('V145 health capability',read('src/app/api/health/route.ts').includes('primaryStandbyProductionClosure:true')&&read('src/app/api/health/route.ts').includes('standbyCommitDriftAllowed:true')&&read('scripts/smoke.mjs').includes('Primary standby closure flag missing'),'health and smoke contracts advertise V145 closure policy');
add('V145 mandatory regression',exists('tests/primary-standby-closure.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/primary-standby-closure.test.mjs'),'V145 topology and closure contracts are mandatory');
add('V145 release notes',exists('EDGEFORCE_V145_RELEASE.md'),'V145 release documentation exists');
add('V146 topology watchdog evaluator',exists('src/lib/productionTopologyWatchdog.ts')&&read('src/lib/productionTopologyWatchdog.ts').includes("schemaVersion:'v146-topology-watchdog-1'")&&read('src/lib/productionTopologyWatchdog.ts').includes('primaryCurrent')&&read('src/lib/productionTopologyWatchdog.ts').includes('standbyLive'),'watchdog evaluates current primary certification and live standby compatibility');
add('V146 bounded standby health probe',read('src/lib/productionTopologyWatchdog.ts').includes('for(let attempt=1;attempt<=3;attempt++)')&&read('src/lib/productionTopologyWatchdog.ts').includes('AbortSignal.timeout(8000)')&&read('src/lib/productionTopologyWatchdog.ts').includes("https://edgeforce-ai.vercel.app"),'canonical Vercel standby health uses bounded retries without deployment');
add('V146 manual-only failover packet',read('src/lib/productionTopologyWatchdog.ts').includes('automaticPromotionAllowed:false')&&read('src/lib/productionTopologyWatchdog.ts').includes('requiresHumanApproval:true')&&read('src/lib/productionTopologyWatchdog.ts').includes('targetDeploymentId'),'failover readiness is explicit while automatic standby promotion remains disabled');
add('V146 hourly topology automation',read('worker/index.ts').includes('/api/cron/topology-watchdog')&&read('src/lib/automationHealth.ts').includes("jobName:'topology-watchdog',maxGapHours:2")&&read('src/app/api/cron/topology-watchdog/route.ts').includes("recordAutomationRun('topology-watchdog'"),'Cloudflare hourly cron continuously records topology readiness');
add('V146 read-only topology operations API',exists('src/app/api/operations/production-topology/route.ts')&&read('src/app/api/operations/production-topology/route.ts').includes('export async function GET')&&!read('src/app/api/operations/production-topology/route.ts').includes('export async function POST'),'operator topology endpoint is read-only');
add('V146 topology dashboard',exists('src/components/ProductionTopologyWatchdogPanel.tsx')&&read('src/components/Dashboard.tsx').includes('ProductionTopologyWatchdogPanel')&&read('src/components/ProductionTopologyWatchdogPanel.tsx').includes('AUTO FAILOVER')&&read('src/components/ProductionTopologyWatchdogPanel.tsx').includes('human approval required'),'dashboard exposes primary, standby and failover readiness without mutation controls');
add('V146 deterministic topology regression',exists('src/app/api/testing/production-topology/route.ts')&&read('src/app/api/testing/production-topology/route.ts').includes('automaticPromotionDisabled')&&read('src/app/api/testing/production-topology/route.ts').includes('badStandbyBlocks')&&read('scripts/smoke.mjs').includes('production topology watchdog regression failed'),'smoke exercises healthy, unhealthy and stale topology states');
add('V146 health capability',read('src/app/api/health/route.ts').includes('productionTopologyWatchdog:true')&&read('src/app/api/health/route.ts').includes('manualFailoverReadiness:true')&&read('src/app/api/health/route.ts').includes('automaticStandbyPromotionDisabled:true'),'health contract advertises watchdog and manual-only failover');
add('V146 mandatory watchdog regression',exists('tests/production-topology-watchdog.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/production-topology-watchdog.test.mjs'),'V146 watchdog and failover invariants are mandatory');
add('V146 Cloudflare secret handoff',read('.github/workflows/deploy-cloudflare.yml').indexOf('Generate Edgeforce runtime secrets')<read('.github/workflows/deploy-cloudflare.yml').indexOf('Build Cloudflare Worker')&&read('.github/workflows/deploy-cloudflare.yml').includes('for ATTEMPT in {1..10}')&&read('.github/workflows/deploy-cloudflare.yml').includes('Waiting for rotated Cloudflare ingest secret propagation'),'runtime secrets exist before Worker build and post-deploy auth retries remain bounded');
add('V146 release notes',exists('EDGEFORCE_V146_RELEASE.md'),'V146 release documentation exists');
add('V147 ESPN CDN fast path preserved',read('src/lib/liveScoreMesh.ts').includes("g.source==='espn-public'||g.source==='espn-cdn'")&&read('src/lib/liveScoreMesh.ts').includes('espnCdnLiveTtlMs=()=>Math.max(750'),'live ESPN CDN upgrades survive final aggregation and run on the 750ms fast path');
add('V147 source-aware score reconciliation',read('src/lib/liveScoreMesh.ts').includes('SOURCE_PRIORITY')&&read('src/lib/liveScoreMesh.ts').includes('liveGameQuality')&&read('src/lib/liveScoreMesh.ts').includes('reconcileLiveGames'),'duplicate live games are resolved by source trust, completeness and freshness instead of fixed merge order');
add('V147 freshness governor',read('src/lib/liveScoreMesh.ts').includes('evaluateLiveScoreFreshness')&&read('src/lib/liveScoreMesh.ts').includes("state:'IDLE'|'FAST'|'HEALTHY'|'DEGRADED'|'STALE'")&&read('src/lib/liveScoreMesh.ts').includes('recommendedUiRefreshMs'),'live score responses expose bounded freshness state and recommended UI cadence');
add('V147 adaptive dashboard polling',read('src/components/Dashboard.tsx').includes('nextDelay=Math.max(500,Math.min(5000')&&read('src/components/Dashboard.tsx').includes('window.setTimeout(adaptiveLoad,nextDelay)'),'dashboard polling follows server freshness guidance without overlapping requests');
add('V147 production cadence config',read('src/lib/liveScoreMesh.ts').includes('LIVE_SCORE_ESPN_CDN_LIVE_CACHE_MS||750')&&read('src/lib/liveScoreMesh.ts').includes('LIVE_SCORE_UI_FAST_MS||750'),'V147 live-score cadence defaults remain active without redundant Worker bindings');
add('V147 health capability',read('src/app/api/health/route.ts').includes('liveScoreFreshnessGovernor:true')&&read('scripts/smoke.mjs').includes('live score freshness governor flag missing'),'health and smoke advertise the V147 live-data controls');
add('V147 deterministic regression',read('tests/live-score-mesh.test.mjs').includes("assert.equal(reconciled[0].source,'espn-cdn')")&&read('tests/live-score-mesh.test.mjs').includes("assert.equal(fresh.state,'FAST')"),'live-score tests prove fast-path selection and freshness-state transitions');
add('V147 release notes',exists('EDGEFORCE_V147_RELEASE.md'),'V147 release documentation exists');
add('V148 cross-source live consensus',read('src/lib/liveScoreMesh.ts').includes('export function liveScoreConsensus')&&read('src/lib/liveScoreMesh.ts').includes('agreeingSources')&&read('src/lib/liveScoreMesh.ts').includes('activeConflict'),'live games carry source-count, corroboration, and contradiction evidence');
add('V148 lag-aware contradiction logic',read('src/lib/liveScoreMesh.ts').includes('consensusWindowMs')&&read('src/lib/liveScoreMesh.ts').includes('lagToleranceMs')&&read('src/lib/liveScoreMesh.ts').includes('laggingSources'),'older divergent feeds are separated from contemporaneous contradictions');
add('V148 consensus telemetry',read('src/lib/liveScoreMesh.ts').includes('summarizeLiveScoreConsensus')&&read('src/lib/liveScoreMesh.ts').includes('corroborationRate')&&read('src/lib/liveScoreMesh.ts').includes('conflictRate'),'score mesh reports live corroboration and conflict rates');
add('V148 operator conflict surface',read('src/components/Dashboard.tsx').includes("g.consensus?.activeConflict?'CONFLICT'")&&read('src/components/Dashboard.tsx').includes('corroborationRate*100'),'dashboard surfaces per-game conflicts and overall corroboration');
add('V148 deterministic runtime regression',exists('src/app/api/testing/live-score-consensus/route.ts')&&read('src/app/api/testing/live-score-consensus/route.ts').includes("schemaVersion:'v148-live-score-consensus-1'")&&read('scripts/smoke.mjs').includes('live score consensus regression failed'),'runtime smoke proves corroboration, lag separation, and conflict detection');
add('V148 production consensus windows',read('src/lib/liveScoreMesh.ts').includes('LIVE_SCORE_CONSENSUS_WINDOW_MS||8000')&&read('src/lib/liveScoreMesh.ts').includes('LIVE_SCORE_LAG_TOLERANCE_MS||3000'),'Cloudflare production uses bounded consensus and lag defaults without redundant Worker bindings');
add('V148 health capability',read('src/app/api/health/route.ts').includes('liveScoreCrossSourceConsensus:true')&&read('src/app/api/health/route.ts').includes('liveScoreConflictDetection:true'),'health contract advertises cross-source score validation');
add('V148 release notes',exists('EDGEFORCE_V148_RELEASE.md'),'V148 release documentation exists');
add('V149 superseded PR run cancellation',read('.github/workflows/verify.yml').includes('group: edgeforce-verify-${{ github.event.pull_request.number || github.ref }}')&&read('.github/workflows/verify-cloudflare.yml').includes('group: edgeforce-verify-cloudflare-${{ github.event.pull_request.number || github.ref }}')&&read('.github/workflows/preview-cloudflare.yml').includes('group: edgeforce-preview-cloudflare-${{ github.event.pull_request.number || github.ref }}')&&[read('.github/workflows/verify.yml'),read('.github/workflows/verify-cloudflare.yml'),read('.github/workflows/preview-cloudflare.yml')].every(x=>x.includes('cancel-in-progress: true')),'new PR commits cancel obsolete validation and preview runs instead of stacking runner work');
add('V149 lockfile-safe CI installs',[read('.github/workflows/verify.yml'),read('.github/workflows/verify-cloudflare.yml'),read('.github/workflows/preview-cloudflare.yml')].every(x=>x.includes('npm install --no-audit --no-fund')&&!x.includes('cache: npm')&&!x.includes('cache-dependency-path: package-lock.json')&&!x.includes('npm ci')),'PR validation does not configure lockfile caching when the repository has no package-lock.json');
add('V149 bounded validation execution',read('.github/workflows/verify.yml').includes('timeout-minutes: 30')&&read('.github/workflows/verify-cloudflare.yml').includes('timeout-minutes: 25')&&read('.github/workflows/preview-cloudflare.yml').includes('timeout-minutes: 25')&&read('.github/workflows/preview-cloudflare.yml').includes('timeout-minutes: 10'),'main verification, Cloudflare verification, preview and cleanup jobs have hard execution ceilings');
add('V149 immutable CI action pins',[read('.github/workflows/verify.yml'),read('.github/workflows/verify-cloudflare.yml'),read('.github/workflows/preview-cloudflare.yml')].every(x=>x.includes('actions/checkout@11d5960a326750d5838078e36cf38b85af677262')&&x.includes('actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020')&&!x.includes('actions/checkout@v4')&&!x.includes('actions/setup-node@v4')),'reviewed checkout and setup-node revisions are immutable in PR validation');
add('V149 production serialization preserved',read('.github/workflows/deploy-cloudflare.yml').includes('group: edgeforce-cloudflare-production')&&read('.github/workflows/deploy-cloudflare.yml').includes('cancel-in-progress: false')&&read('.github/workflows/deploy-cloudflare.yml').includes('Reject a superseded production commit'),'PR convergence changes do not weaken serialized production release safety');
add('V149 mandatory convergence regression',exists('tests/ci-convergence.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/ci-convergence.test.mjs'),'CI convergence invariants are part of mandatory post-typecheck tests');
add('V149 health capability',read('src/app/api/health/route.ts').includes('ciSupersededRunCancellation:true')&&read('src/app/api/health/route.ts').includes('lockfileSafeCiInstall:true')&&read('src/app/api/health/route.ts').includes('npmInstallFallbackWithoutLockfile:true')&&read('scripts/smoke.mjs').includes('CI superseded-run cancellation flag missing'),'health and smoke advertise V149 CI convergence controls');
add('V149 release notes',exists('EDGEFORCE_V149_RELEASE.md'),'V149 release documentation exists');
add('V150 certified final-score settlement gate',read('src/lib/scoreSettlementFallback.ts').includes('evaluateFinalScoreSettlementEvidence')&&read('src/lib/scoreSettlementFallback.ts').includes('TRUSTED_FINAL_SCORE_SOURCES')&&read('src/lib/scoreSettlementFallback.ts').includes('contemporaneous score or status conflict is unresolved'),'final-score fallback grades only evidence-approved final scores');
add('V150 conflict and low-confidence fail closed',read('src/lib/scoreSettlementFallback.ts').includes("confidence==='LOW'")&&read('src/lib/scoreSettlementFallback.ts').includes('activeConflict')&&read('tests/score-settlement-fallback.test.mjs').includes('blocks unresolved score conflicts, low confidence'),'unresolved contradictions and low-confidence finals cannot settle fallback wagers');
add('V150 trusted primary single-source policy',read('src/lib/scoreSettlementFallback.ts').includes("'nhl-web','mlb-statsapi','espn-cdn','espn-public'")&&read('tests/score-settlement-fallback.test.mjs').includes('trusted primary single-source finals'),'league-native and ESPN primary finals can settle without a second feed only when no contradiction is present');
add('V150 settlement evidence telemetry',read('src/lib/scoreSettlementFallback.ts').includes('blockedFinalGames')&&read('src/lib/resultProvider.ts').includes('fallbackEvidence:fallback.evidence')&&read('src/lib/resultProvider.ts').includes('fallbackEvidenceCertified'),'automatic settlement reports accepted, blocked, confidence and conflict evidence');
add('V150 deterministic settlement runtime regression',exists('src/app/api/testing/settlement-evidence/route.ts')&&read('src/app/api/testing/settlement-evidence/route.ts').includes("schemaVersion:'v150-certified-score-settlement-1'")&&read('scripts/smoke.mjs').includes('settlement evidence regression failed'),'runtime smoke proves corroborated acceptance and conflict/untrusted blocking');
add('V150 health capability',read('src/app/api/health/route.ts').includes('certifiedScoreSettlementEvidence:true')&&read('src/app/api/health/route.ts').includes('settlementConflictFailClosed:true')&&read('scripts/smoke.mjs').includes('certified score settlement evidence flag missing'),'health and smoke advertise certified score settlement controls');
add('V150 release notes',exists('EDGEFORCE_V150_RELEASE.md'),'V150 release documentation exists');
add('V151 fallback provenance payload',read('src/lib/scoreSettlementFallback.ts').includes("schemaVersion:'v151-settlement-provenance-1'")&&read('src/lib/scoreSettlementFallback.ts').includes("evidenceClass:decision.trustedSingleSource?'TRUSTED_PRIMARY_SINGLE':'CORROBORATED_SCORE'")&&read('src/lib/scoreSettlementFallback.ts').includes('finalScore:{'),'score-fallback settlement rows carry the exact evidence class, provider and final score');
add('V151 provider-native provenance',read('src/lib/resultProvider.ts').includes("evidenceClass:'PROVIDER_NATIVE'")&&read('src/lib/resultProvider.ts').includes('settlementProvenanceWritten:reconciliation.provenanceWritten'),'configured result-provider rows also carry explicit provenance');
add('V151 idempotent leg evidence persistence',read('src/lib/ledger.ts').includes('jsonb_set(')&&read('src/lib/ledger.ts').includes("metadata->'settlementProvenance') is distinct from")&&read('src/lib/ledger.ts').includes('provenanceWritten+=evidenceRows.length'),'settlement evidence is persisted on the exact leg only when provenance changes');
add('V151 durable evidence ledger event',read('src/lib/ledger.ts').includes("'RESULT_EVIDENCE_APPLIED'")&&read('src/lib/ledger.ts').includes('settlementProvenance:provenance')&&read('src/lib/ledger.ts').includes('evidenceEvents++'),'every newly persisted result-evidence record gets an audit ledger event');
add('V151 settlement evidence audit API',exists('src/app/api/ledger/settlement-evidence/route.ts')&&read('src/app/api/ledger/settlement-evidence/route.ts').includes("schemaVersion:'v151-durable-settlement-provenance-1'")&&read('src/lib/ledger.ts').includes("where le.event_type='RESULT_EVIDENCE_APPLIED'"),'operators can retrieve bounded durable settlement provenance tied to settled legs');
add('V151 mandatory provenance regression',exists('tests/settlement-provenance.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/settlement-provenance.test.mjs'),'durable provenance invariants are part of mandatory post-typecheck tests');
add('V151 health capability',read('src/app/api/health/route.ts').includes('durableSettlementProvenance:true')&&read('scripts/smoke.mjs').includes('durable settlement provenance flag missing')&&read('scripts/smoke.mjs').includes('settlement evidence history endpoint failed'),'health and smoke certify durable settlement provenance and its read API');
add('V151 release notes',exists('EDGEFORCE_V151_RELEASE.md'),'V151 release documentation exists');
add('V152 settlement learning policy',exists('src/lib/settlementLearning.ts')&&read('src/lib/settlementLearning.ts').includes("evidenceClass:'PROVIDER_NATIVE'")&&read('src/lib/settlementLearning.ts').includes("evidenceClass:'TRUSTED_PRIMARY_SINGLE'")&&read('src/lib/settlementLearning.ts').includes('trainingEligible:false'),'settlement evidence maps to one explicit learning eligibility policy');
add('V152 feedback provenance persistence',read('src/lib/predictionFeedback.ts').includes('settlementLearningPolicy(result.settlementProvenance)')&&read('src/lib/predictionFeedback.ts').includes('settlementProvenance:result.settlementProvenance||null')&&read('src/lib/predictionFeedback.ts').includes('settlementLearning'),'historical prediction feedback stores provenance and its derived learning policy');
add('V152 recalibration evidence gate',read('src/lib/recalibrationEngine.ts').includes('settlementLearningFromFeatures(row.features).trainingEligible')&&read('src/lib/recalibrationEngine.ts').includes('rowsExcludedByEvidence'),'recalibration excludes explicitly weak settlement evidence and reports exclusions');
add('V152 governance evidence gate',read('src/lib/modelGovernance.ts').includes('settlementLearningFromFeatures(row.features).trainingEligible')&&read('src/lib/modelGovernance.ts').includes('rowsExcludedByEvidence'),'model governance uses the same settlement evidence eligibility standard');
add('V152 validation evidence gate',read('src/lib/validationLab.ts').includes('settlementLearningFromFeatures(row.features).trainingEligible'),'validation lab excludes explicitly ineligible settlement evidence');
add('V152 training engine evidence gates',read('src/lib/trainedSportModels.ts').includes('settlementLearningFromFeatures(row.features).trainingEligible')&&read('src/lib/externalMlTournament.ts').includes('settlementLearningFromFeatures(row.features).trainingEligible'),'internal sport-model training and external ML tournaments share the evidence eligibility gate');
add('V152 legacy learning compatibility',read('src/lib/settlementLearning.ts').includes("evidenceClass:'LEGACY_UNVERIFIED'")&&read('src/lib/settlementLearning.ts').includes('trainingEligible:true')&&read('tests/settlement-learning.test.mjs').includes('legacy history remains eligible'),'pre-V152 historical outcomes remain usable while new weak evidence is excluded');
add('V152 deterministic learning regression',exists('src/app/api/testing/settlement-learning/route.ts')&&read('src/app/api/testing/settlement-learning/route.ts').includes("schemaVersion:'v152-settlement-learning-1'")&&exists('tests/settlement-learning.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/settlement-learning.test.mjs')&&read('scripts/smoke.mjs').includes('settlement learning regression failed'),'unit and runtime smoke verify evidence-aware learning policy');
add('V152 health capability',read('src/app/api/health/route.ts').includes('evidenceAwareRecalibration:true')&&read('src/app/api/health/route.ts').includes('weakSettlementEvidenceTrainingExclusion:true')&&read('scripts/smoke.mjs').includes('evidence-aware recalibration flag missing'),'health and smoke advertise the evidence-aware learning controls');
add('V152 release notes',exists('EDGEFORCE_V152_RELEASE.md'),'V152 release documentation exists');
add('V153 evidence-weighted backtesting',read('src/lib/backtest.ts').includes('settlementLearningFromFeatures(r.features).evidenceWeight')&&read('src/lib/backtest.ts').includes('effectiveSampleSize:totalWeight')&&read('src/lib/backtest.ts').includes('brier+=(p-r.outcome)**2*weight'),'backtest outcomes are weighted by settlement evidence and expose effective sample size');
add('V153 evidence-weighted calibration',read('src/lib/modelCalibration.ts').includes('effectiveSampleSize')&&read('src/lib/modelCalibration.ts').includes('settlementLearningFromFeatures(row.features).evidenceWeight'),'calibration buckets and calibration error use settlement evidence weight');
add('V153 evidence-weighted rolling performance',read('src/lib/modelPerformance.ts').includes('confidenceDecay(ageDays)*evidenceWeight')&&read('src/lib/modelPerformance.ts').includes('effectiveSampleSize:summary.effectiveSampleSize'),'recency scoring combines time decay with settlement evidence weight');
add('V153 evidence-weighted recalibration strength',read('src/lib/recalibrationEngine.ts').includes('const effectiveSampleSize=allSummary.effectiveSampleSize')&&read('src/lib/recalibrationEngine.ts').includes('const shrinkage=effectiveSampleSize/(effectiveSampleSize+options.shrinkageSamples)'),'model-weight movement shrinks against effective evidence rather than raw row count');
add('V153 internal weighted sport model',read('src/lib/trainedSportModels.ts').includes('evidenceWeight:settlementLearningFromFeatures(row.features).evidenceWeight')&&read('src/lib/trainedSportModels.ts').includes('gradB+=error*row.evidenceWeight')&&read('src/lib/trainedSportModels.ts').includes('holdoutEffectiveSampleSize:holdoutMetrics.effectiveSampleSize'),'internal logistic training, calibration and holdout evaluation consume evidence weights');
add('V153 external weighted ML contract',read('src/lib/externalMlTournament.ts').includes('evidenceWeight:settlementLearningFromFeatures(row.features).evidenceWeight')&&read('ml-service/app.py').includes('evidenceWeight: float = Field(default=1.0, ge=0.05, le=1.0)')&&read('ml-service/app.py').includes('sample_weight=sample_weight')&&read('ml-service/app.py').includes('brier_score_loss(y, p, sample_weight=sample_weight)'),'external ML receives evidence weight and applies it during fitting, calibration and metrics');
add('V153 deterministic weighted-learning regression',exists('src/app/api/testing/evidence-weighted-learning/route.ts')&&read('src/app/api/testing/evidence-weighted-learning/route.ts').includes("schemaVersion:'v153-evidence-weighted-learning-1'")&&exists('tests/evidence-weighted-learning.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/evidence-weighted-learning.test.mjs')&&read('scripts/smoke.mjs').includes('evidence-weighted learning regression failed'),'unit and runtime smoke prove evidence weight changes analytics');
add('V153 health capability',read('src/app/api/health/route.ts').includes('evidenceWeightedBacktesting:true')&&read('src/app/api/health/route.ts').includes('evidenceWeightedExternalMlTraining:true')&&read('scripts/smoke.mjs').includes('evidence-weighted backtesting flag missing'),'health and smoke advertise evidence-weighted learning controls');
add('V153 release notes',exists('EDGEFORCE_V153_RELEASE.md'),'V153 release documentation exists');
add('V155 forecast research engine',exists('src/lib/forecastResearchLab.ts')&&read('src/lib/forecastResearchLab.ts').includes('buildForecastResearchReport')&&read('src/lib/forecastResearchLab.ts').includes('forecastTemporalReplay')&&read('src/lib/forecastResearchLab.ts').includes('forecastReliabilityBands'),'historical forecasts have a dedicated research-only calibration and temporal replay engine');
add('V155 research-only contract',read('src/lib/forecastResearchLab.ts').includes('researchOnly:true')&&read('src/app/api/testing/forecast-research/route.ts').includes('noExecutionOutput')&&!read('src/app/api/intelligence/forecast-research/route.ts').includes('export async function POST'),'forecast research is read-only and runtime-tested for execution isolation');
add('V155 deterministic research fingerprint',read('src/lib/forecastResearchLab.ts').includes('forecastResearchFingerprint')&&read('src/lib/forecastResearchLab.ts').includes('fnv1a')&&read('tests/forecast-research-lab.test.mjs').includes('fingerprint is deterministic'),'research reports carry deterministic reproducibility fingerprints');
add('V155 weighted forecast reliability',read('src/lib/forecastResearchLab.ts').includes('settlementLearningFromFeatures(row.features).evidenceWeight')&&read('src/lib/forecastResearchLab.ts').includes('calibrationGap')&&read('src/lib/forecastResearchLab.ts').includes('effectiveSampleSize'),'research scoring respects settlement-evidence weight and reports reliability depth');
add('V155 temporal drift research',read('src/lib/forecastResearchLab.ts').includes("state:'STABLE'|'WATCH'|'DRIFTING'|'INSUFFICIENT'")&&read('src/lib/forecastResearchLab.ts').includes('brierDelta')&&read('src/lib/forecastResearchLab.ts').includes('calibrationDelta'),'forecast research compares recent and prior probability quality without execution output');
add('V155 research API and UI',exists('src/app/api/intelligence/forecast-research/route.ts')&&exists('src/components/ForecastResearchLabPanel.tsx')&&exists('src/app/research/page.tsx')&&read('src/app/page.tsx').includes('Forecast Research'),'forecast research is available through a read-only API and dedicated operator page');
add('V155 mandatory research regression',exists('tests/forecast-research-lab.test.mjs')&&String(pkg.scripts.posttypecheck).includes('tests/forecast-research-lab.test.mjs')&&read('scripts/smoke.mjs').includes('forecast research regression failed'),'forecast research math and hosted runtime contract are mandatory release gates');
add('V155 health capability',read('src/app/api/health/route.ts').includes('forecastResearchLab:true')&&read('src/app/api/health/route.ts').includes('researchExecutionIsolation:true')&&read('scripts/smoke.mjs').includes('forecast research lab flag missing'),'health and smoke advertise the research-only forecast evaluation surface');
add('V155 release notes',exists('EDGEFORCE_V155_RELEASE.md'),'V155 release documentation exists');
const failed=checks.filter(x=>!x.ok);
const report={ok:failed.length===0,expected,passed:checks.length-failed.length,failed:failed.length,checks};
const summary={ok:report.ok,expected,passed:report.passed,failed:report.failed,failedChecks:failed};
console.log(JSON.stringify(summary,null,2));
if(process.env.RELEASE_AUDIT_VERBOSE==='true')console.log(JSON.stringify(report,null,2));
if(failed.length)process.exit(1);
