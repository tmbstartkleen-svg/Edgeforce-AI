const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3000';

async function get(path){
 const res=await fetch(base+path,{redirect:'manual'});
 const text=await res.text();
 let body=null;
 try{body=JSON.parse(text)}catch{}
 return {res,body,text};
}

async function post(path,payload){
 const res=await fetch(base+path,{
  method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify(payload),
  redirect:'manual'
 });
 const text=await res.text();
 let body=null;
 try{body=JSON.parse(text)}catch{}
 return {res,body,text};
}

function assert(condition,message){
 if(!condition)throw new Error(message);
}

const live=await get('/api/health/live');
assert(live.res.ok&&live.body?.live===true,'liveness endpoint failed');
assert(live.body?.version==='72.0.0','liveness version mismatch');

const health=await get('/api/health');
assert(health.res.ok,'health endpoint failed');
assert(health.body?.ok===true,'health payload not ok');
assert(health.body?.version==='72.0.0','unexpected health version');
assert(health.body?.modelVersion==='edgeforce-v72','unexpected model version');
assert(health.body?.releaseIdentityMatch===true,'runtime/release identity mismatch');
assert(health.body?.migrationVersion===84,'unexpected migration version');
assert(health.body?.persistentWagerLedger===true,'persistent wager ledger flag missing');
assert(health.body?.automaticSettlement===true,'automatic settlement flag missing');
assert(health.body?.providerCircuitBreaker===true,'provider circuit breaker flag missing');
assert(health.body?.providerPayloadFreshnessGate===true,'payload freshness gate flag missing');
assert(health.body?.walkForwardCalibration===true,'walk-forward calibration flag missing');
assert(health.body?.controlledWeightPromotion===true,'controlled weight promotion flag missing');
assert(health.body?.productionHardened===true,'production hardening flag missing');
assert(health.body?.providerCertification===true,'provider certification flag missing');
assert(health.body?.launchDoctor===true,'launch doctor flag missing');
assert(health.body?.eventLevelJointSimulation===true,'event-level joint simulation flag missing');
assert(health.body?.sharedEventStateSimulation===true,'shared event-state simulation flag missing');
assert(health.body?.empiricalSameGameCorrelation===true,'empirical same-game correlation flag missing');
assert(health.body?.learnedSgpCorrelation===true,'learned SGP correlation flag missing');
assert(health.body?.sportMicroSimulation===true,'sport micro simulation flag missing');
assert(health.body?.multiProviderConsensusPricing===true,'multi-provider consensus flag missing');
assert(health.body?.targetBookPricePreservation===true,'target-book price preservation flag missing');
assert(health.body?.explicitSharpPublicBookRoles===true,'explicit market-role flag missing');
assert(health.body?.additiveExplainability===true,'additive explainability flag missing');
assert(health.body?.componentAblation===true,'component ablation flag missing');
assert(health.body?.featureSensitivity===true,'feature sensitivity flag missing');
assert(health.body?.liveReadOnlyWhatIf===true,'live what-if flag missing');
assert(health.body?.batchDataContractAudit===true,'batch data contract flag missing');
assert(health.body?.durableAutomationHealth===true,'durable automation health flag missing');
assert(health.body?.productionCertification===true,'production certification flag missing');
assert(health.body?.unifiedIntelligenceCertification===true,'unified intelligence certification flag missing');
assert(health.body?.failSoftIntelligenceGate===true,'fail-soft intelligence gate flag missing');
assert(health.body?.intradayInjuryAutomationMonitored===true,'injury automation monitoring flag missing');
assert(health.body?.crossSportFinalBlendOptimizer===true,'cross-sport final blend optimizer flag missing');
assert(health.body?.mutationBodyLimit===true,'mutation body limit flag missing');
assert(health.body?.hardenedContentSecurityPolicy===true,'CSP hardening flag missing');
assert(health.body?.championChallengerGovernance===true,'champion challenger governance flag missing');
assert(health.body?.probabilityDriftDetection===true,'probability drift detection flag missing');
assert(health.body?.automaticDriftWeightBrakes===true,'automatic drift weight brake flag missing');
assert(health.body?.nativeRealOddsIngestion===true,'native real odds ingestion flag missing');
assert(health.body?.adaptiveFullSlateOdds===true,'adaptive full-slate odds flag missing');
assert(health.body?.quotaAwareProviderExpansion===true,'quota-aware provider expansion flag missing');
assert(health.body?.liveParlayProductionData===true,'live parlay production-data flag missing');
assert(health.body?.recommendationQualityTiering===true,'recommendation quality tiering flag missing');
assert(health.body?.sportAwareContextQuality===true,'sport-aware context quality flag missing');
assert(health.body?.realContextDataNetwork===true,'real context data network flag missing');
assert(health.body?.predictionValidationLaboratory===true,'prediction validation laboratory flag missing');
assert(health.body?.outOfSampleValidation===true,'out-of-sample validation flag missing');
assert(health.body?.brierSkillBenchmarking===true,'Brier skill benchmarking flag missing');
assert(health.body?.confidenceBandCalibration===true,'confidence-band calibration flag missing');
assert(health.body?.contextContributionAudit===true,'context contribution audit flag missing');
assert(health.body?.simulationContributionAudit===true,'simulation contribution audit flag missing');
assert(health.body?.validationGatedModelWeights===true,'validation-gated model weights flag missing');
assert(health.body?.durableValidationSnapshots===true,'durable validation snapshots flag missing');
assert(health.body?.espnPublicContext===true,'ESPN public context flag missing');
assert(health.body?.openMeteoWeatherContext===true,'Open-Meteo context flag missing');
assert(health.body?.contextFieldProvenance===true,'context field provenance flag missing');
assert(health.body?.configuredProviderOverridePriority===true,'configured-provider override flag missing');
assert(health.body?.publicContextCaching===true,'public context caching flag missing');
assert(health.body?.contextProviderCaching===true,'context provider caching flag missing');
assert(health.body?.contextGatedAutomation===true,'context-gated automation flag missing');
assert(health.body?.contextQualityAuditTrail===true,'context quality audit trail flag missing');
assert(health.body?.contextIntelligenceApi===true,'context intelligence API flag missing');
assert(health.body?.contextRiskRecommendationGate===true,'context risk recommendation gate flag missing');
assert(health.body?.longshotIsolation===true,'longshot isolation flag missing');
assert(health.body?.negativeEvParlayRejection===true,'negative-EV parlay rejection flag missing');
assert(health.body?.persistedLiveSnapshotReuse===true,'persisted live snapshot reuse flag missing');
assert(health.body?.publicPredictionMarketFallback===true,'public prediction market fallback flag missing');
assert(health.body?.allMarketPredictionTerminal===true,'all-market prediction terminal flag missing');
assert(health.body?.predictionMarketWarehouse===true,'prediction market warehouse flag missing');
assert(health.body?.predictionMarketTradeTape===true,'prediction trade tape flag missing');
assert(health.body?.predictionMarketMovers===true,'prediction market movers flag missing');
assert(health.body?.predictionTraderIntelligence===true,'prediction trader intelligence flag missing');
assert(health.body?.predictionDecisionSignals===true,'prediction decision signals flag missing');
assert(health.body?.durablePredictionSignalHistory===true,'prediction signal history flag missing');
assert(health.body?.polymarketPublicLeaderboard===true,'Polymarket public leaderboard flag missing');
assert(health.body?.iPhonePredictionPwa===true,'iPhone prediction PWA flag missing');
assert(health.body?.cloudflarePredictionCollector===true,'Cloudflare prediction collector flag missing');
assert(health.body?.runtimeNeonMigrationBootstrap===true,'runtime Neon migration bootstrap flag missing');
assert(health.body?.cloudflareRuntimeIdentity===true,'Cloudflare runtime identity flag missing');
assert(health.body?.cloudflareDeployPreflight===true,'Cloudflare deployment preflight flag missing');
assert(health.body?.liveDataStatus===true,'live data status flag missing');
assert(health.body?.productionRealDataOnly===true,'production real-data-only flag missing');
assert(health.body?.cloudflareCronAutopilot===true,'Cloudflare cron autopilot flag missing');
assert(health.body?.liveComebackWatch===true,'live comeback watch flag missing');
assert(health.body?.buyLowReviewGuardrails===true,'buy-low guardrail flag missing');
assert(health.body?.liveGameStateConfirmationRequired===true,'live game-state confirmation flag missing');
assert(health.body?.expertModelingSuite===true,'expert modeling suite flag missing');
assert(health.body?.nativeExpertModels===true,'native expert model flag missing');
assert(health.body?.externalMlModelBridge===true,'external ML bridge flag missing');
assert(health.body?.normalizedPremiumSportsDataBridge===true,'premium data bridge flag missing');
assert(health.body?.expertModelCouncilIntegration===true,'expert model council integration flag missing');
assert(health.body?.trainedSportSpecificMl===true,'trained sport ML flag missing');
assert(health.body?.chronologicalMlTraining===true,'chronological ML training flag missing');
assert(health.body?.trainedModelCalibration===true,'trained model calibration flag missing');
assert(health.body?.marketBaselinePromotionGate===true,'trained model market baseline gate missing');
assert(health.body?.trainedModelRegistry===true,'trained model registry flag missing');
assert(health.body?.dailyAutoTraining===true,'daily auto training flag missing');
assert(health.body?.externalMlTournament===true,'external ML tournament flag missing');
assert(health.body?.xgboostTournament===true,'XGBoost tournament flag missing');
assert(health.body?.lightgbmTournament===true,'LightGBM tournament flag missing');
assert(health.body?.catboostTournament===true,'CatBoost tournament flag missing');
assert(health.body?.randomForestTournament===true,'Random Forest tournament flag missing');
assert(health.body?.stackingTournament===true,'stacking tournament flag missing');
assert(health.body?.bayesianTournament===true,'Bayesian tournament flag missing');
assert(health.body?.explicitExternalMlPromotion===true,'explicit external ML promotion flag missing');
assert(health.body?.externalMlChampionRegistry===true,'external ML champion registry flag missing');
assert(health.body?.mlServiceActivation===true,'ML service activation flag missing');
assert(health.body?.mlServiceHealthProbe===true,'ML service health probe flag missing');
assert(health.body?.mlPredictionHandshake===true,'ML prediction handshake flag missing');
assert(health.body?.mlServiceCircuitBreaker===true,'ML service circuit breaker flag missing');
assert(health.body?.renderBlueprint===true,'Render Blueprint flag missing');
assert(health.body?.persistentMlArtifactDisk===true,'persistent ML artifact disk flag missing');
assert(health.body?.mlDeploymentAutomation===true,'ML deployment automation flag missing');
assert(health.body?.renderApiDeploy===true,'Render API deployment flag missing');
assert(health.body?.renderDeployHookFallback===true,'Render deploy-hook fallback flag missing');
assert(health.body?.exactMlCommitVerification===true,'exact ML commit verification flag missing');
assert(health.body?.vercelMlEnvironmentWiring===true,'Vercel ML environment wiring flag missing');
assert(health.body?.mlDeploymentAttestation===true,'ML deployment attestation flag missing');
assert(health.body?.postDeployMlActivation===true,'post-deploy ML activation flag missing');
assert(health.body?.firstChampionTournament===true,'first champion tournament flag missing');
assert(health.body?.sportAlgorithmLeaderboard===true,'sport algorithm leaderboard flag missing');
assert(health.body?.championHistory===true,'champion history flag missing');
assert(health.body?.hostedChampionArtifactVerification===true,'hosted champion artifact verification flag missing');
assert(health.body?.persistentChampionEvidence===true,'persistent champion evidence flag missing');
assert(health.body?.championLiveSettlement===true,'champion live settlement flag missing');
assert(health.body?.championDriftMonitoring===true,'champion drift monitoring flag missing');
assert(health.body?.championMarketRelativeDrift===true,'champion market-relative drift flag missing');
assert(health.body?.championTwoStrikeQuarantine===true,'champion two-strike quarantine flag missing');
assert(health.body?.championRetirementEndpoint===true,'champion retirement endpoint flag missing');
assert(health.body?.championNativeFallback===true,'champion native fallback flag missing');
assert(health.body?.championDriftHistory===true,'champion drift history flag missing');
assert(health.body?.shadowChallengerRecovery===true,'shadow challenger recovery flag missing');
assert(health.body?.shadowPredictionIsolation===true,'shadow prediction isolation flag missing');
assert(health.body?.shadowZeroProductionWeight===true,'shadow zero-production-weight flag missing');
assert(health.body?.shadowMarketBaselineBenchmark===true,'shadow market baseline benchmark flag missing');
assert(health.body?.shadowNativeBaselineBenchmark===true,'shadow native baseline benchmark flag missing');
assert(health.body?.shadowFreshEvidenceConfirmation===true,'shadow fresh-evidence confirmation flag missing');
assert(health.body?.postQuarantineLiveProof===true,'post-quarantine live proof flag missing');
assert(health.body?.artifactVerifiedShadowRecovery===true,'artifact-verified shadow recovery flag missing');
assert(health.body?.multiChallengerShadowLeague===true,'multi-challenger shadow league flag missing');
assert(health.body?.concurrentShadowCompetitors===true,'concurrent shadow competitors flag missing');
assert(health.body?.shadowLeagueLiveRanking===true,'shadow league live ranking flag missing');
assert(health.body?.shadowLeagueWinnerMarginGate===true,'shadow league winner-margin flag missing');
assert(health.body?.shadowLeagueMinimumCompetitors===true,'shadow league minimum competitors flag missing');
assert(health.body?.shadowLeagueWinnerOnlyPromotion===true,'shadow league winner-only promotion flag missing');

const liveComebackTest=await get('/api/testing/live-comeback');
assert(liveComebackTest.res.ok&&liveComebackTest.body?.ok===true,'live comeback regression failed');
assert(liveComebackTest.body?.assertions?.gameStateGuardrail===true,'live comeback game-state guardrail failed');

const expertModelsTest=await get('/api/testing/expert-models');
assert(expertModelsTest.res.ok&&expertModelsTest.body?.ok===true,'expert model regression failed');
assert(expertModelsTest.body?.assertions?.councilIntegrated===true,'expert suite is not integrated into model council');

const expertModels=await get('/api/intelligence/expert-models');
assert(expertModels.res.ok&&expertModels.body?.ok===true,'expert model API failed');
assert(expertModels.body?.build==='V61','expert model API build mismatch');
assert(Array.isArray(expertModels.body?.catalog)&&expertModels.body.catalog.length>=20,'expert software catalog incomplete');

const trainedModelsTest=await get('/api/testing/trained-models');
assert(trainedModelsTest.res.ok&&trainedModelsTest.body?.ok===true,'trained sport ML regression failed');
assert(trainedModelsTest.body?.assertions?.positiveSkill===true,'trained sport ML failed market baseline skill test');
assert(trainedModelsTest.body?.assertions?.promoted===true,'trained sport ML synthetic champion was not promoted');
assert(trainedModelsTest.body?.assertions?.directional===true,'trained sport ML directionality failed');

const trainedModels=await get('/api/intelligence/trained-models');
assert(trainedModels.res.ok&&trainedModels.body?.ok===true,'trained model status API failed');
assert(trainedModels.body?.build==='V54'&&trainedModels.body?.schemaVersion==='v54-trained-sport-ml-1','trained model API identity mismatch');

const mlTournamentTest=await get('/api/testing/ml-tournament');
assert(mlTournamentTest.res.ok&&mlTournamentTest.body?.ok===true,'ML tournament regression failed');
assert(mlTournamentTest.body?.assertions?.promotesClearWinner===true,'ML tournament winner promotion failed');
assert(mlTournamentTest.body?.assertions?.retainsIncumbentInsideMargin===true,'ML tournament incumbent margin failed');
assert(mlTournamentTest.body?.assertions?.blocksIneligible===true,'ML tournament eligibility gate failed');

const mlTournament=await get('/api/intelligence/ml-tournament');
assert(mlTournament.res.ok&&mlTournament.body?.ok===true,'ML tournament status API failed');
assert(mlTournament.body?.build==='V55'&&mlTournament.body?.schemaVersion==='v55-external-ml-tournament-1','ML tournament API identity mismatch');

const mlActivationTest=await get('/api/testing/ml-activation');
assert(mlActivationTest.res.ok&&mlActivationTest.body?.ok===true,'ML activation state regression failed');
assert(mlActivationTest.body?.assertions?.unconfigured===true,'ML activation unconfigured state failed');
assert(mlActivationTest.body?.assertions?.awaitingEvidence===true,'ML activation evidence state failed');
assert(mlActivationTest.body?.assertions?.active===true,'ML activation active state failed');

const mlActivation=await get('/api/intelligence/ml-service');
assert(mlActivation.res.ok&&mlActivation.body?.ok===true,'ML service activation status API failed');
assert(mlActivation.body?.build==='V61'&&mlActivation.body?.schemaVersion==='v61-ml-activation-1','ML activation API identity mismatch');

const mlDeploymentTest=await get('/api/testing/ml-deployment');
assert(mlDeploymentTest.res.ok&&mlDeploymentTest.body?.ok===true,'ML deployment regression failed');
assert(mlDeploymentTest.body?.assertions?.releaseIdentity===true,'ML deployment release identity failed');
assert(mlDeploymentTest.body?.assertions?.activeRequiresChampion===true,'ML deployment active champion gate failed');

const mlDeployment=await get('/api/ml/deploy-attest');
assert(mlDeployment.res.ok&&mlDeployment.body?.ok===true,'ML deployment attestation API failed');
assert(mlDeployment.body?.build==='V61'&&mlDeployment.body?.schemaVersion==='v61-ml-deployment-attestation-1','ML deployment attestation identity mismatch');

const mlFirstTournamentTest=await get('/api/testing/ml-first-tournament');
assert(mlFirstTournamentTest.res.ok&&mlFirstTournamentTest.body?.ok===true,'first champion tournament regression failed');
assert(mlFirstTournamentTest.body?.assertions?.ranksWinner===true,'first tournament ranking failed');
assert(mlFirstTournamentTest.body?.assertions?.blocksMissingArtifact===true,'missing artifact gate failed');
assert(mlFirstTournamentTest.body?.assertions?.awaitsChampion===true,'awaiting champion evidence gate failed');

const mlChampions=await get('/api/intelligence/ml-champions');
assert(mlChampions.res.ok&&mlChampions.body?.ok===true,'ML champion intelligence API failed');
assert(mlChampions.body?.build==='V61'&&mlChampions.body?.schemaVersion==='v61-first-champion-tournament-1','ML champion intelligence identity mismatch');

const mlChampionDriftTest=await get('/api/testing/ml-champion-drift');
assert(mlChampionDriftTest.res.ok&&mlChampionDriftTest.body?.ok===true,'ML champion drift regression failed');
assert(mlChampionDriftTest.body?.assertions?.insufficientHeld===true,'drift insufficient-sample gate failed');
assert(mlChampionDriftTest.body?.assertions?.firstCriticalConfirms===true,'first critical confirmation gate failed');
assert(mlChampionDriftTest.body?.assertions?.repeatedCriticalQuarantines===true,'repeated critical quarantine gate failed');
assert(mlChampionDriftTest.body?.assertions?.watchDoesNotQuarantine===true,'watch state incorrectly quarantined');

const mlDrift=await get('/api/intelligence/ml-drift');
assert(mlDrift.res.ok&&mlDrift.body?.ok===true,'ML champion drift status API failed');
assert(mlDrift.body?.build==='V59'&&mlDrift.body?.schemaVersion==='v59-ml-champion-drift-1','ML champion drift API identity mismatch');

const mlShadowRecoveryTest=await get('/api/testing/ml-shadow-recovery');
assert(mlShadowRecoveryTest.res.ok&&mlShadowRecoveryTest.body?.ok===true,'ML shadow recovery regression failed');
assert(mlShadowRecoveryTest.body?.assertions?.beatsMarket===true,'shadow challenger did not beat market synthetic baseline');
assert(mlShadowRecoveryTest.body?.assertions?.beatsNative===true,'shadow challenger did not beat native synthetic baseline');
assert(mlShadowRecoveryTest.body?.assertions?.cooldownBlocks===true,'shadow cooldown gate failed');
assert(mlShadowRecoveryTest.body?.assertions?.firstPassConfirms===true,'shadow first-pass confirmation failed');
assert(mlShadowRecoveryTest.body?.assertions?.repeatedFreshPassPromotes===true,'shadow repeated fresh evidence promotion failed');
assert(mlShadowRecoveryTest.body?.assertions?.badShadowRejected===true,'bad shadow challenger rejection failed');
assert(mlShadowRecoveryTest.body?.assertions?.clearLeagueWinnerPromotes===true,'clear league winner promotion failed');
assert(mlShadowRecoveryTest.body?.assertions?.closeLeagueRaceHolds===true,'close shadow league race was not held');
assert(mlShadowRecoveryTest.body?.assertions?.minimumCompetitorsRequired===true,'shadow league minimum-competitor gate failed');
assert(mlShadowRecoveryTest.body?.assertions?.leagueLeaderMustConfirm===true,'shadow league leader confirmation gate failed');

const mlShadowRecovery=await get('/api/intelligence/ml-shadow-recovery');
assert(mlShadowRecovery.res.ok&&mlShadowRecovery.body?.ok===true,'ML shadow recovery status API failed');
assert(mlShadowRecovery.body?.build==='V61'&&mlShadowRecovery.body?.schemaVersion==='v61-shadow-league-1','ML shadow recovery API identity mismatch');

const ready=await get('/api/health/ready');
assert(ready.res.ok&&ready.body?.ready===true,'local readiness endpoint failed');

const releaseReady=await get('/api/release/readiness');
assert(releaseReady.res.ok&&releaseReady.body?.ready===true,'release readiness endpoint failed');
assert(releaseReady.body?.version==='72.0.0','release readiness version mismatch');

const deployment=await get('/api/deployment/smoke');
assert(deployment.res.ok&&deployment.body?.smoke===true,'deployment smoke failed');
assert(deployment.body?.version==='72.0.0','deployment smoke version mismatch');
assert(deployment.body?.checks?.migrations==='v84','deployment migration identity mismatch');

const diagnostics=await get('/api/diagnostics');
assert(diagnostics.res.ok&&diagnostics.body?.ok===true,'diagnostics failed');
assert(diagnostics.body?.version==='72.0.0','diagnostics version mismatch');
assert(diagnostics.body?.granularSportEngines===7,'granular sport engine count mismatch');

const ops=await get('/api/ops/status');
assert(ops.res.ok&&ops.body?.ok===true,'ops status endpoint failed');
assert(ops.body?.version==='72.0.0','ops status version mismatch');

const ledger=await get('/api/ledger/wagers');
assert(ledger.res.ok&&ledger.body?.ok===true,'ledger endpoint failed');
assert(ledger.body?.analytics?.overall?.net!==undefined,'ledger analytics missing');

const failure=await get('/api/testing/provider-failure');
assert(failure.res.ok,'provider failure simulation unavailable');
assert(failure.body?.selected==='secondary','provider circuit breaker did not skip quarantined primary');

const payloadQuality=await get('/api/testing/payload-quality');
assert(payloadQuality.res.ok&&payloadQuality.body?.ok===true,'payload quality gate simulation failed');
assert(payloadQuality.body?.fresh?.ok===true,'fresh payload was rejected');
assert(payloadQuality.body?.stale?.ok===false,'stale payload was not rejected');
assert(payloadQuality.body?.empty?.ok===false,'empty odds payload was not rejected');

const providerCertification=await get('/api/testing/provider-certification');
assert(providerCertification.res.ok&&providerCertification.body?.ok===true,'provider certification guardrail simulation failed');
assert(providerCertification.body?.ready?.launchReady===true,'certified odds provider did not clear launch gate');
assert(providerCertification.body?.blocked?.launchReady===false,'failed odds provider did not block launch');

const providerCertificationStatus=await get('/api/providers/certify');
assert(providerCertificationStatus.res.ok&&providerCertificationStatus.body?.ok===true,'provider certification status endpoint failed');

const launchDoctor=await get('/api/launch-doctor');
assert(launchDoctor.body?.ok===true&&launchDoctor.body?.version==='72.0.0','launch doctor endpoint failed');

const jointSimulation=await get('/api/testing/joint-simulation');
assert(jointSimulation.res.ok&&jointSimulation.body?.ok===true,'joint simulation directionality test failed');
assert(jointSimulation.body?.positive?.probability>jointSimulation.body?.independent,'positive correlation did not lift joint probability');
assert(jointSimulation.body?.negative?.probability<jointSimulation.body?.independent,'negative correlation did not reduce joint probability');
assert(jointSimulation.body?.shared?.engine==='SHARED_EVENT_STATE','shared event-state engine did not activate');
assert(jointSimulation.body?.shared?.scenarioCoverage===1,'shared event-state scenario coverage incomplete');

const sgpCorrelation=await get('/api/intelligence/sgp-correlation');
assert(sgpCorrelation.res.ok&&sgpCorrelation.body?.ok===true,'SGP correlation status endpoint failed');

const microSimulation=await get('/api/testing/micro-simulation');
assert(microSimulation.res.ok&&microSimulation.body?.ok===true,'micro simulation coverage test failed');
assert(Array.isArray(microSimulation.body?.results)&&microSimulation.body.results.length===7,'micro simulation engine coverage incomplete');
assert(microSimulation.body?.propRouting?.engine==='PLAYER_DISTRIBUTION_MONTE_CARLO','player prop routing regressed');
assert(microSimulation.body?.partialRouting?.engine==='PROBABILITY_STATE_FALLBACK','partial-market fallback regressed');
assert(microSimulation.body?.tennisTotalRouting?.engine==='TENNIS_POINT_GAME_SET_MONTE_CARLO','tennis total-games routing regressed');
assert(microSimulation.body?.tennisTotalRouting?.unit==='games','tennis total-games audit unit mismatch');

const microCatalog=await get('/api/intelligence/micro-simulation');
assert(microCatalog.res.ok&&microCatalog.body?.ok===true,'micro simulation catalog endpoint failed');
assert(Array.isArray(microCatalog.body?.engines)&&microCatalog.body.engines.length===7,'micro simulation catalog incomplete');

const marketConsensus=await get('/api/testing/market-consensus');
assert(marketConsensus.res.ok&&marketConsensus.body?.ok===true,'market consensus regression test failed');
assert(marketConsensus.body?.row?.consensus?.targetBookFound===true,'target-book consensus preservation failed');
assert(marketConsensus.body?.row?.consensus?.marketStructure==='SHARP_OVER_PUBLIC','sharp/public role structure failed');
assert(marketConsensus.body?.row?.consensus?.outlierBooks?.includes('BadBook'),'consensus outlier rejection failed');

const marketConsensusStatus=await get('/api/intelligence/market-consensus');
assert(marketConsensusStatus.res.ok&&marketConsensusStatus.body?.ok===true,'market consensus intelligence endpoint failed');

const regimeConfidence=await get('/api/testing/regime-confidence');
assert(regimeConfidence.res.ok&&regimeConfidence.body?.ok===true,'regime confidence regression test failed');
assert(regimeConfidence.body?.stable?.dynamicConfidence>regimeConfidence.body?.dislocated?.dynamicConfidence,'dynamic confidence did not degrade in dislocated regime');
assert(regimeConfidence.body?.dislocated?.regime==='DISLOCATED','dislocated regime classification failed');

const regimeStatus=await get('/api/intelligence/regime-confidence');
assert(regimeStatus.res.ok&&regimeStatus.body?.ok===true,'regime confidence intelligence endpoint failed');

const modelGovernance=await get('/api/testing/model-governance');
assert(modelGovernance.res.ok&&modelGovernance.body?.ok===true,'model governance regression test failed');
assert(modelGovernance.body?.champion?.modelName==='Stable Champion','champion selection regressed');
assert(modelGovernance.body?.drifting?.driftStatus==='CRITICAL','critical model drift detection failed');
assert(Number(modelGovernance.body?.drifting?.runtimeMultiplier)<Number(modelGovernance.body?.stable?.runtimeMultiplier),'drift brake did not reduce runtime influence');

const modelGovernanceStatus=await get('/api/intelligence/model-governance');
assert(modelGovernanceStatus.res.ok&&modelGovernanceStatus.body?.ok===true,'model governance intelligence endpoint failed');

const portfolioStress=await get('/api/testing/portfolio-stress');
assert(portfolioStress.res.ok&&portfolioStress.body?.ok===true,'portfolio stress regression test failed');
assert(portfolioStress.body?.drawdown?.drawdownBrake<portfolioStress.body?.normal?.drawdownBrake,'continuous drawdown brake did not reduce risk');
assert(portfolioStress.body?.drawdown?.totalStake<portfolioStress.body?.normal?.totalStake,'drawdown brake did not reduce allocation');
assert(portfolioStress.body?.normal?.worstScenario?.cvar95Loss>=0,'portfolio CVaR output invalid');

const explainability=await get('/api/testing/explainability');
assert(explainability.res.ok&&explainability.body?.ok===true,'explainability regression test failed');
assert(explainability.body?.reconstructed===true,'explainability contribution reconstruction failed');
assert(explainability.body?.componentCoverage===true,'component ablation coverage failed');
assert(explainability.body?.featureCoverage===true,'feature ablation coverage failed');

const whatIf=await post('/api/what-if',{marketId:'demo-mlb',featureDeltas:{starter:.20},context:{homeAdvantage:.01}});
assert(whatIf.res.ok&&whatIf.body?.readOnly===true,'read-only what-if endpoint failed');
assert(Math.abs(Number(whatIf.body?.delta?.ensembleProbability||0))>.0001,'what-if did not move ensemble probability');
assert(Boolean(whatIf.body?.scenarioExplanation?.diagnostics?.fragility),'what-if explanation diagnostics missing');

const dataContract=await get('/api/testing/data-contract');
assert(dataContract.res.ok&&dataContract.body?.ok===true,'data contract regression test failed');
assert(dataContract.body?.broken?.invalidRows>=2,'data contract invalid-row detection failed');
assert(dataContract.body?.broken?.duplicateRows>=1,'data contract duplicate detection failed');

const automationHealthTest=await get('/api/testing/automation-health');
assert(automationHealthTest.res.ok&&automationHealthTest.body?.ok===true,'automation health regression test failed');
assert(automationHealthTest.body?.mixed?.healthy===false,'automation stale/failed classification regressed');

const securityHardening=await get('/api/testing/security-hardening');
assert(securityHardening.res.ok&&securityHardening.body?.ok===true,'security hardening regression test failed');
assert(securityHardening.body?.maxMutationBytes===1048576,'mutation body ceiling regressed');

const automationHealth=await get('/api/automation/health');
assert(automationHealth.res.ok&&automationHealth.body?.ok===true,'automation health endpoint failed');

const contextQuality=await get('/api/testing/context-quality');
assert(contextQuality.res.ok&&contextQuality.body?.ok===true,'context quality regression failed');
assert(contextQuality.body?.nfl?.recommendationReady===true,'NFL context-ready classification regressed');
assert(contextQuality.body?.mlb?.recommendationReady===false,'MLB partial context classification regressed');
assert(contextQuality.body?.mlb?.missingCritical?.includes('lineup'),'MLB critical context gap not detected');
assert(contextQuality.body?.playerRequirements?.includes('playerProjection'),'player projection context requirement missing');

const contextIntelligence=await get('/api/intelligence/context');
assert(contextIntelligence.res.ok&&contextIntelligence.body?.ok===true,'context intelligence endpoint failed');
assert(contextIntelligence.body?.build==='V51','context intelligence build identity mismatch');
assert(Boolean(contextIntelligence.body?.provenanceCoverage),'context provenance coverage missing');
assert(Boolean(contextIntelligence.body?.diagnostics?.publicNetwork),'public context diagnostics missing');
assert(Boolean(contextIntelligence.body?.diagnostics?.qualitySummary),'context quality summary missing');

const publicContextNetwork=await get('/api/testing/public-context-network');
assert(publicContextNetwork.res.ok&&publicContextNetwork.body?.ok===true,'public context network regression failed');
assert(publicContextNetwork.body?.event?.venue?.city==='East Rutherford','ESPN venue parsing regressed');
assert(Number(publicContextNetwork.body?.signals?.injury)>0,'directional injury signal regressed');
assert(Number(publicContextNetwork.body?.signals?.quarterback)<0,'quarterback context signal regressed');

const validationRegression=await get('/api/testing/validation-lab');
assert(validationRegression.res.ok&&validationRegression.body?.ok===true,'prediction validation regression failed');
assert(validationRegression.body?.good?.promotionEligible===true,'qualified validation model was not eligible');
assert(validationRegression.body?.bad?.promotionEligible===false,'failed validation model was incorrectly eligible');
assert(validationRegression.body?.paired?.better==='ALTERNATIVE','paired simulation comparison regressed');

const validationLab=await get('/api/intelligence/validation-lab');
assert(validationLab.res.ok&&validationLab.body?.ok===true,'validation laboratory endpoint failed');
assert(validationLab.body?.build==='V51','validation laboratory build identity mismatch');
assert(Boolean(validationLab.body?.report?.overall),'validation laboratory overall report missing');

const recommendationQuality=await get('/api/testing/recommendation-quality');
assert(recommendationQuality.res.ok&&recommendationQuality.body?.ok===true,'recommendation quality regression failed');
assert(recommendationQuality.body?.recommended?.tier==='RECOMMENDED','recommended tier regressed');
assert(recommendationQuality.body?.value?.tier==='VALUE_WATCHLIST','value watchlist tier regressed');
assert(recommendationQuality.body?.hail?.tier==='HAIL_MARY','Hail Mary tier regressed');
assert(recommendationQuality.body?.rejected?.tier==='REJECTED','negative-EV rejection tier regressed');

const parlayFallback=await get('/api/testing/parlay-fallback');
assert(parlayFallback.res.ok&&parlayFallback.body?.ok===true,'parlay fallback regression failed');
assert(parlayFallback.body?.strict?.qualification==='STRICT','strict parlay tier regressed');
assert(parlayFallback.body?.fallback?.qualification==='WATCH_FALLBACK','watch fallback parlay tier regressed');

const oddsRefreshPolicy=await get('/api/testing/odds-refresh-policy');
assert(oddsRefreshPolicy.res.ok&&oddsRefreshPolicy.body?.ok===true,'adaptive odds refresh policy regression failed');
assert(oddsRefreshPolicy.body?.expanded?.mode==='EXPANDED','expanded refresh policy regressed');
assert(oddsRefreshPolicy.body?.reserve?.mode==='BOOTSTRAP_ONLY','quota reserve policy regressed');

const predictionIntelligence=await get('/api/testing/prediction-intelligence');
assert(predictionIntelligence.res.ok&&predictionIntelligence.body?.ok===true,'prediction intelligence regression failed');
assert(predictionIntelligence.body?.category==='ECONOMICS','prediction category classifier regressed');
assert(predictionIntelligence.body?.mover?.probabilityChange>0.14,'prediction mover calculation regressed');
assert(predictionIntelligence.body?.signal?.rank===5,'prediction trader leaderboard join regressed');
assert(predictionIntelligence.body?.decision?.action==='BUY_YES','all-market buy decision regression failed');
assert(predictionIntelligence.body?.decision?.venue==='Kalshi','all-market venue routing regression failed');

const liveParlays=await get('/api/parlays?size=2&view=week');
assert(liveParlays.res.ok&&liveParlays.body?.ok===true,'live parlay endpoint failed');
assert(liveParlays.body?.build==='V51','live parlay route build identity mismatch');
assert(liveParlays.body?.schemaVersion==='v51-prediction-validation-1','live parlay route schema mismatch');
assert(Array.isArray(liveParlays.body?.parlays),'live parlay response missing parlays array');
assert(Array.isArray(liveParlays.body?.recommended),'recommended parlay board missing');
assert(Array.isArray(liveParlays.body?.valueWatchlist),'value watchlist parlay board missing');
assert(Array.isArray(liveParlays.body?.hailMary),'Hail Mary parlay board missing');
assert(Number(liveParlays.body?.thresholds?.recommendedMinJoint)===0.52,'recommended joint threshold regressed');

const liveDataStatus=await get('/api/live-data/status');
assert(liveDataStatus.res.ok&&liveDataStatus.body?.ok===true,'live data status endpoint failed');

const liveDataQuality=await get('/api/data-quality');
assert(liveDataQuality.res.ok&&liveDataQuality.body?.ok===true,'live data quality audit failed');
assert(Boolean(liveDataQuality.body?.audit?.grade),'live data quality grade missing');

const productionCertification=await post('/api/release/certify',{});
assert(productionCertification.res.ok&&productionCertification.body?.ok===true,'production certification dry-run failed');
assert(productionCertification.body?.certified===true,'local production certification did not certify');
assert(productionCertification.body?.security?.ok===true,'production certification security posture failed');
assert(productionCertification.body?.modelGovernance?.ok===true,'production certification model governance status missing');
assert(productionCertification.body?.modelValidation?.ok===true,'production certification model validation status missing');

const v1Readiness=await get('/api/release/v1-readiness');
assert(v1Readiness.res.ok,'v1 readiness endpoint failed');
assert(['GO','CONDITIONAL'].includes(String(v1Readiness.body?.verdict)),'local v1 readiness should not be NO_GO');
assert(Array.isArray(v1Readiness.body?.gates)&&v1Readiness.body.gates.length>=10,'v1 readiness gate set missing');
assert(v1Readiness.body?.evidence?.securityOk===true,'v1 readiness security evidence missing');

const productionLaunch=await get('/api/release/launch-status');
assert(productionLaunch.res.ok&&productionLaunch.body?.ok===true,'production launch status endpoint failed');
assert(['NOT_STARTED','IN_PROGRESS','READY','FAILED','ROLLED_BACK','STALE'].includes(String(productionLaunch.body?.state)),'production launch state invalid');

const modelDiagnostics=await get('/api/intelligence/model-diagnostics');
assert(modelDiagnostics.res.ok&&modelDiagnostics.body?.ok===true,'model diagnostics endpoint failed');

const recalibration=await get('/api/testing/recalibration');
assert(recalibration.res.ok&&recalibration.body?.ok===true,'recalibration guardrail simulation failed');
assert(recalibration.body?.good?.promoted===true,'qualified model was not promoted');
assert(recalibration.body?.bad?.promoted===false,'poor holdout model was promoted');
assert(recalibration.body?.small?.promoted===false,'small-sample model was promoted');

const contextChanges=await get('/api/context-changes');
assert(contextChanges.res.ok,'context change audit endpoint failed');

const lineMovement=await get('/api/intelligence/line-movement');
assert(lineMovement.res.ok,'line movement endpoint failed');

const calibrationStatus=await get('/api/intelligence/calibration');
assert(calibrationStatus.res.ok,'calibration status endpoint failed');

const backtest=await get('/api/intelligence/backtest');
assert(backtest.res.ok,'walk-forward backtest endpoint failed');

const home=await get('/');
assert(home.res.ok,'dashboard failed');
assert(home.res.headers.get('x-content-type-options')==='nosniff','security header missing');
assert(home.res.headers.get('x-frame-options')==='DENY','frame protection missing');
assert(Boolean(home.res.headers.get('strict-transport-security')),'HSTS header missing');
assert(Boolean(home.res.headers.get('content-security-policy')),'CSP header missing');
assert(Boolean(home.res.headers.get('x-edgeforce-request-id')),'request id missing');
assert(String(health.res.headers.get('cache-control')||'').includes('no-store'),'API no-store cache policy missing');

console.log(JSON.stringify({ok:true,base,checks:[
 'liveness','health','readiness','release-readiness','deployment-smoke','diagnostics','ops-status','ledger',
 'provider-failure','payload-quality','provider-certification','launch-doctor','joint-simulation','sgp-correlation','micro-simulation','micro-catalog','market-consensus','market-consensus-status','regime-confidence','regime-confidence-status','model-governance','model-governance-status','portfolio-stress','explainability','what-if','model-diagnostics','data-contract','automation-health-test','security-hardening','automation-health','context-quality','context-intelligence','public-context-network','validation-lab-regression','validation-lab','recommendation-quality','parlay-fallback','odds-refresh-policy','prediction-intelligence','live-parlays','data-quality','production-certification','recalibration','context-changes','line-movement','calibration-status','backtest','dashboard-security'
]}));
