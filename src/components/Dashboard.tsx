'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {buildMixedSportProbabilitySet,buildProbabilitySet,type Parlay} from '@/lib/parlays';
import {fmtOdds,fmtPct} from '@/lib/math';
import type {Scanned} from '@/lib/scanner';
import type {RiskProfile} from '@/lib/types';
import type {LearnedSgpMap} from '@/lib/learnedSgpCorrelation';
import MarketDrilldown from './MarketDrilldown';
import PredictionIntelligencePanel from './PredictionIntelligencePanel';
import OperatorCommandCenter from './OperatorCommandCenter';
import ExpertModelSuitePanel from './ExpertModelSuitePanel';
import TrainedSportModelsPanel from './TrainedSportModelsPanel';
import ExternalMlTournamentPanel from './ExternalMlTournamentPanel';
import MlServiceActivationPanel from './MlServiceActivationPanel';
import MlDeploymentAutomationPanel from './MlDeploymentAutomationPanel';
import FirstChampionTournamentPanel from './FirstChampionTournamentPanel';
import ChampionDriftPanel from './ChampionDriftPanel';
import ShadowRecoveryPanel from './ShadowRecoveryPanel';
import PlayerFeatureFramesPanel from './PlayerFeatureFramesPanel';
import PlayerCalibrationPanel from './PlayerCalibrationPanel';
import OpponentMatchupPanel from './OpponentMatchupPanel';
import LineupRedistributionPanel from './LineupRedistributionPanel';
import StartingLineupPanel from './StartingLineupPanel';
import ScheduleFatiguePanel from './ScheduleFatiguePanel';
import VenueConditionsPanel from './VenueConditionsPanel';
import MarketMovementLearningPanel from './MarketMovementLearningPanel';
import CrossSportOptimizerPanel from './CrossSportOptimizerPanel';
import UnifiedIntelligencePanel from './UnifiedIntelligencePanel';
import ReliabilitySupervisorPanel from './ReliabilitySupervisorPanel';
import DeploymentGuardPanel from './DeploymentGuardPanel';
import VercelGovernorPanel from './VercelGovernorPanel';
import ProductionTopologyWatchdogPanel from './ProductionTopologyWatchdogPanel';
import SloGovernorPanel from './SloGovernorPanel';
import {buildTradeSignal,findCrossVenueOpportunity} from '@/lib/tradeSignals';
import {buildBoardPriority,buildBoardPriorityMap,buildBoardRankDeltas,buildBoardRobustness,summarizeBoardRankDeltaMap,summarizeBoardRobustness} from '@/lib/boardRobustness';

type BoardRow=Scanned & {
  dailyScore:number;
  weeklyScore:number;
  probabilityGap:number;
  calendarDay:string;
  rawImpliedProbability:number;
  noVigProbability:number;
  sportsbookEdge:number;
  quarterKelly:number;
  predictionMarketProbability?:number;
  predictionMarketVolume?:number;
  predictionMarketSource?:string;
  predictionMarketTitle?:string;
  predictionMarketStatus:'MATCHED'|'ILLIQUID'|'UNKNOWN_LIQUIDITY'|'NO_MATCH';
  predictionEdge?:number;
  predictionVenueQuotes:Array<{
    source:string;contractId:string;title:string;probability:number;executionProbability:number;
    bidProbability?:number;askProbability?:number;spreadProbability?:number;
    volume?:number;liquidity?:number;matchScore:number;
    status:'MATCHED'|'ILLIQUID'|'UNKNOWN_LIQUIDITY'|'NO_MATCH';
    edge:number;expectedValue:number;
  }>;
  bestPredictionVenue?:{
    source:string;contractId:string;title:string;probability:number;executionProbability:number;
    volume?:number;liquidity?:number;matchScore:number;
    status:'MATCHED'|'ILLIQUID'|'UNKNOWN_LIQUIDITY'|'NO_MATCH';
    edge:number;expectedValue:number;
  };
  bestExecutionVenue:{
    venue:string;type:'SPORTSBOOK'|'PREDICTION_EXCHANGE';edge:number;expectedValue:number;
    marketProbability:number;americanOdds?:number;contractId?:string;matchScore?:number;feeAdjusted:boolean;
  };
  lineMovement?:{
    openerOdds:number;
    currentOdds:number;
    openerProbability:number;
    currentProbability:number;
    probabilityMove:number;
    oddsMove:number;
    snapshotCount:number;
    direction:'TOWARD'|'AWAY'|'FLAT';
    steam:boolean;
    steamStrength:'NONE'|'WATCH'|'STRONG';
  }|null;
};

type PredictionContract={
  id:string;
  title:string;
  category:string;
  yesProbability:number;
  noProbability:number;
  modelProbability:number;
  probabilityDifference:number;
  volume?:number;
  expiresAt?:string;
  source:string;
};

type SummaryRow={
  key:string;
  count:number;
  hits:number;
  misses:number;
  pushes?:number;
  pending?:number;
  hitRate:number;
  staked?:number;
  returned?:number;
  net?:number;
  roi?:number;
};

type LiveScoreGame={
  id:string;
  sport:string;
  league:string;
  source:string;
  status:'SCHEDULED'|'LIVE'|'FINAL'|'DELAYED'|'UNKNOWN';
  detail:string;
  clock?:string;
  period?:string;
  startTime?:string;
  home:{name:string;score:number|null};
  away:{name:string;score:number|null};
  observedAt:string;
  consensus?:{
    confidence:'HIGH'|'MEDIUM'|'LOW'|'SINGLE_SOURCE';
    sourceCount:number;
    observationCount:number;
    agreeingSources:number;
    sources:string[];
    selectedSource:string;
    scoreConflict:boolean;
    statusConflict:boolean;
    activeConflict:boolean;
    laggingSources:string[];
    reasons:string[];
  };
};

type LiveBoardResponse={
  generatedAt:string;
  uiRefreshMs:number;
  sourceRefreshMs:number;
  view:'today'|'week';
  limit:30|50;
  risk:RiskProfile;
  source:string;
  providerMode:string;
  providerName?:string;
  providerDegraded?:boolean;
  providerQuality?:{grade:string;qualityScore:number;rowCount:number;payloadAgeMin?:number}|null;
  providerAttempts?:Array<{providerId:string;ok:boolean;skipped?:boolean;circuitState?:string;qualityGrade?:string;qualityScore?:number;error?:string}>;
  targetBook?:string;
  providerPanel?:Array<{
    providerId:string;providerName:string;bookmaker:string;marketRole:string;
    configuredWeight:number;effectiveWeight:number;acceptedMarkets:number;
    qualityGrade?:string;qualityScore?:number;latencyMs?:number;freshnessFactor?:number;transportScore?:number;
  }>;
  consensusCoverage?:{
    targetBook:string;configuredFeeds:number;acceptedFeeds:number;rows:number;multiBookRows:number;
    targetBookRows:number;averageAgreement:number;averageDispersion:number;priceShopOpportunities:number;
    outlierRows:number;classifiedRows:number;sharpOverPublic:number;publicOverSharp:number;aligned:number;
  };
  edgeScanner?:{
    quoteCount:number;
    groupCount:number;
    arbitrageCount:number;
    positiveEvCount:number;
    sharpReferenceGroups:number;
    consensusReferenceGroups:number;
    arbitrage:Array<{
      key:string;sport:string;league:string;event:string;market:string;startTime:string;
      outcomeCount:number;impliedProbabilitySum:number;roi:number;
      stakePlan:Array<{selection:string;book:string;odds:number;stakeFraction:number;payoutMultiple:number}>;
    }>;
    positiveEv:Array<{
      key:string;sport:string;league:string;event:string;market:string;selection:string;startTime:string;
      book:string;odds:number;fairProbability:number;fairOdds:number;edge:number;expectedValue:number;
      fullKelly:number;fractionalKelly:number;reference:string;referenceBooks:string[];
    }>;
    methodology:{arbitrage:string;devig:string;expectedValue:string;kellyFraction:number;extraProviderRequests:number};
  };
  dynamicCalibrationProfileCount?:number;
  regimeCoverage?:{
    stable:number;volatile:number;dislocated:number;thin:number;unknown:number;
    highConfidence:number;mediumConfidence:number;lowConfidence:number;averageDynamicConfidence:number;
  };
  warnings?:string[];
  topBoardQualification?:{
    requested:number;candidates:number;qualified:number;shown:number;withheld:number;forced:boolean;
    minimumSimProbability:number;minimumDynamicConfidence:number;allowedGrades:string[];
  };
  contextRevision?:string;
  contextChanges?:Array<{
    id:string;
    marketId:string;
    event:string;
    selection:string;
    sport:string;
    type:string;
    severity:'INFO'|'WATCH'|'ACTION';
    reason:string;
    detectedAt:string;
  }>;
  resimulationTriggered?:boolean;
  resimulatedMarketIds?:string[];
  resimulationResults?:Array<{
    marketId:string;
    selection:string;
    simProbability:number;
    modelProbability:number;
    expectedValue:number;
    grade:string;
    simEngine:string;
  }>;
  contextDiagnostics?:{
    matchedRows:number;
    totalRows:number;
    qualitySummary:{
      totalRows:number;scoredRows:number;recommendationReadyRows:number;completeRows:number;goodRows:number;
      partialRows:number;thinRows:number;noneRows:number;averageScore:number;averageCoverage:number;
      averageCriticalCoverage:number;missingCritical:string[];
    };
    publicNetwork?:{enabled:boolean;totalEvents:number;matchedEvents:number;eventMatchRate?:number;weatherRows?:number;summaryRows?:number;restRows?:number;playerRows?:number;requests?:number;warnings?:string[]};
    providers:Array<{kind:string;ok:boolean;providerId?:string;rowCount:number;qualityScore:number}>;
  };
  rows:BoardRow[];
  sports:string[];
  liveScores?:{
    ok:boolean;
    generatedAt:string;
    refreshMs:number;
    uiRefreshMs?:number;
    sourceMode:string;
    liveGames:number;
    freshness?:{
      state:'IDLE'|'FAST'|'HEALTHY'|'DEGRADED'|'STALE';
      maxLiveAgeMs:number|null;
      clockCoverage:number;
      scoreCoverage:number;
      staleLiveGames:number;
      selectedSourceCount:number;
      sourceCounts:Array<{source:string;count:number}>;
      recommendedUiRefreshMs:number;
    };
    consensus?:{
      liveGames:number;
      high:number;
      medium:number;
      low:number;
      singleSource:number;
      activeConflicts:number;
      corroborated:number;
      corroborationRate:number;
      conflictRate:number;
      consensusWindowMs:number;
      lagToleranceMs:number;
    };
    games:LiveScoreGame[];
    warnings:string[];
  };
  fanduelPulse?:{
    ok:boolean;
    generatedAt:string|null;
    sequence:number|null;
    liveTotal:number;
    prematchTotal:number;
    latencyMs:number;
    fresh:boolean;
    ageMs:number|null;
    warning?:string;
  };
  learnedSgpCorrelations?:LearnedSgpMap;
  learnedSgpProfileCount?:number;
  predictions:{
    mode:string;
    source:string|null;
    contracts:PredictionContract[];
    error?:string;
  };
  steamCount?:number;
  predictionCoverage?:{
    minimumVolume:number;
    matched:number;
    illiquid:number;
    unknownLiquidity:number;
    unmatched:number;
  };
  history:{
    overall:SummaryRow;
    sports:SummaryRow[];
    legCounts:SummaryRow[];
    markets:SummaryRow[];
    legSports?:SummaryRow[];
    probabilityBands?:SummaryRow[];
    sampleSize:number;
    settledCount?:number;
    pendingCount?:number;
    avgModelWinner?:number;
    avgModelLoser?:number;
    bestSport?:string;
    bestParlaySize?:string;
  };
  historicalBets:Array<{
    id:string;
    confidence:'confirmed'|'partial';
    sport:string;
    legCount:number;
    stake:number;
    paid:number;
    result:'win'|'loss'|'push'|'open';
  }>;
  anomalies:Array<{
    id:string;
    severity:'HIGH'|'MEDIUM'|'LOW';
    sport:string;
    selection:string;
    score:number;
    reason:string;
  }>;
};

type EdgeScannerApiResponse={
  ok:boolean;
  result?:NonNullable<LiveBoardResponse['edgeScanner']>;
  error?:string;
  message?:string;
};

type PortfolioApiResponse={
  source:string;
  result:{
    totalStake:number;
    totalStakePct:number;
    expectedProfit:number;
    expectedRoi:number;
    positions:Array<{
      id:string;
      stake:number;
      stakePct:number;
      marginalEv:number;
      eventExposurePct:number;
      sportExposurePct:number;
      correlationExposurePct:number;
      leg:Scanned;
    }>;
    rejected:Array<{id:string;reason:string}>;
    drawdownBrake:number;
    stressScale:number;
    stress:{
      runsPerScenario:number;
      drawdownLimitPct:number;
      worstScenario:{
        scenario:string;meanPnl:number;var95Loss:number;cvar95Loss:number;maxLoss:number;
        probabilityOfLoss:number;drawdownBreachProbability:number;volatility:number;
      };
      baseScenario:{
        scenario:string;meanPnl:number;var95Loss:number;cvar95Loss:number;maxLoss:number;
        probabilityOfLoss:number;drawdownBreachProbability:number;volatility:number;
      };
      scenarios:Array<{
        scenario:string;meanPnl:number;p05:number;p10:number;p50:number;p90:number;p95:number;
        var95Loss:number;cvar95Loss:number;maxLoss:number;probabilityOfLoss:number;
        drawdownBreachProbability:number;volatility:number;runs:number;
      }>;
    };
  };
};

type ModelDiagnosticsResponse={
  ok:boolean;
  source:string;
  sampleSize:number;
  summary:{
    fragility:{robust:number;moderate:number;fragile:number};
    averageAgreement:number;
    averageEffectiveModelCount:number;
    averageWeightConcentration:number;
    averageAbsoluteEdge:number;
    dominantModels:Array<{name:string;count:number}>;
  };
  mostFragile:Array<{
    market:{id:string;sport:string;event:string;selection:string;market:string};
    explanation:{edge:number;diagnostics:{fragility:string;fragilityRatio:number;dominantModel:string;dominantWeight:number;councilAgreement:number}};
  }>;
};

type ModelGovernanceResponse={
  ok:boolean;
  source:string;
  latestRun?:{
    id:number;
    modelVersion:string;
    status:string;
    predictionRows:number;
    groupsEvaluated:number;
    champions:number;
    challengers:number;
    watchCount:number;
    driftingCount:number;
    criticalCount:number;
    completedAt?:string|null;
  }|null;
  summary:{
    champions:number;
    challengers:number;
    watch:number;
    drifting:number;
    critical:number;
    averagePsi:number;
  };
  profiles:Array<{
    modelName:string;
    sport:string;
    marketKey:string;
    role:'CHAMPION'|'CHALLENGER'|'MONITORED'|'HELD';
    driftStatus:'HEALTHY'|'WATCH'|'DRIFTING'|'CRITICAL'|'INSUFFICIENT';
    baselineSampleSize:number;
    recentSampleSize:number;
    psi:number;
    brierDelta:number;
    logLossDelta:number;
    calibrationDelta:number;
    effectiveScore:number;
    weightBrake:number;
    runtimeMultiplier:number;
    reason:string;
    asOf:string;
  }>;
};

type ReleaseCertificationResponse={
  ok:boolean;
  latest?:{
    id:number;
    releaseVersion:string;
    modelVersion:string;
    commitSha?:string|null;
    environment:string;
    certified:boolean;
    blockers?:string[];
    warnings?:string[];
    createdAt:string;
  }|null;
};

type AutomationHealthResponse={
  ok:boolean;
  source:string;
  healthy:boolean;
  healthyCount:number;
  pendingCount:number;
  failedCount:number;
  staleCount:number;
  blockers:string[];
  warnings:string[];
  jobs:Array<{
    jobName:string;
    state:'HEALTHY'|'STALE'|'FAILED'|'PENDING';
    lastRun?:string|null;
    ageHours?:number|null;
    status?:string|null;
  }>;
};

type DataQualityResponse={
  ok:boolean;
  source:string;
  providerId?:string|null;
  audit:{
    score:number;
    grade:'TRUSTED'|'USABLE'|'CAUTION'|'REJECT';
    rowCount:number;
    validRows:number;
    invalidRows:number;
    duplicateRows:number;
    staleRows:number;
    consensusDepthCoverage:number;
    featureCoverage:number;
    blockers:string[];
    warnings:string[];
  };
};


type ParlayBoardResponse={
  ok:boolean;
  recommendationStatus:'QUALIFIED'|'NO_STRICT_LEGS'|'NO_COMBINATION_CLEARED_RISK_GATES';
  generatedAt:string;
  candidateLegs:number;
  gradeCounts:{ELITE:number;STRONG:number;WATCH:number;PASS:number};
  strictEligible:number;
  watchEligible:number;
  generatedParlayCandidates:number;
  rejectedParlayCandidates:number;
  thresholds:{
    recommendedMinJoint:number;
    recommendedMinLeg:number;
    recommendedMinConfidence:number;
    recommendedMaxModelSimulationGap:number;
    recommendedMinContextCoverage:number;
    valueMinJoint:number;
    extremeUnderdogOdds:number;
    hailMaryCombinedOdds:number;
  };
  recommended:Parlay[];
  valueWatchlist:Parlay[];
  hailMary:Parlay[];
};

type DbStats={
  configured:boolean;
  ok:boolean;
  counts?:{
    athletes?:number;
    player_game_stats?:number;
    market_snapshots?:number;
    market_consensus_snapshots?:number;
    model_runs?:number;
    bet_results?:number;
    automation_runs?:number;
    production_certifications?:number;
    model_governance_runs?:number;
    model_governance_snapshots?:number;
    validation_runs?:number;
    validation_snapshots?:number;
  };
};


type ValidationLabResponse={
  ok:boolean;
  source:string;
  latestRun?:{
    id:number;modelVersion:string;status:string;predictionRows:number;groupsEvaluated:number;
    evidencePassed:number;evidenceHeld:number;completedAt?:string|null;
  }|null;
  report:{
    sampleSize:number;
    overall:{
      summary:{brierScore:number;logLoss:number;avgClv:number;roi:number;hitRate:number};
      calibrationError:number;
      brierSkillScore:number;
      logLossImprovement:number;
      holdout:{sampleSize:number;brierScore:number;logLoss:number};
      holdoutCalibrationError:number;
      walkForwardFolds:number;
      walkForwardBrier:number;
      contextContribution:{richSampleSize:number;thinSampleSize:number;brierDelta:number;logLossDelta:number};
      simulationComparison:{sampleSize:number;brierDelta:number;better:string};
    };
    evidence:{verified:number;qualified:number;provisional:number;insufficient:number;failed:number;promotionEligible:number};
    diagnostics:{contextTaggedRows:number;simulationTaggedRows:number;closingLineRows:number;modelVersions:string[]};
    groups:Array<{modelName:string;sport:string;marketKey:string;sampleSize:number;evidenceGrade:string;promotionEligible:boolean;reason:string;metrics:{brierSkillScore:number;holdout:{brierScore:number};calibrationError:number}}>;
  };
};

type CalibrationResponse={
  source:string;
  latestRun?:{
    id:number;
    modelVersion:string;
    status:string;
    predictionRows:number;
    groupsEvaluated:number;
    groupsPromoted:number;
    groupsHeld:number;
    completedAt?:string;
  }|null;
  weights:Array<{
    modelName:string;
    sport:string;
    marketKey:string;
    multiplier:number;
    sampleSize:number;
    holdoutSampleSize?:number;
    calibrationError?:number;
    brierScore?:number;
    promoted:boolean;
    reason?:string;
  }>;
  models:Array<{
    modelName:string;
    sport:string;
    marketKey:string;
    sampleSize:number;
    decayedScore:number;
    confidenceLabel:string;
    calibrationError?:number;
    brierScore?:number;
  }>;
};

const emptyBoard:LiveBoardResponse={
  generatedAt:'',
  uiRefreshMs:1000,
  sourceRefreshMs:10000,
  view:'today',
  limit:30,
  risk:'Moderate',
  source:'loading',
  providerMode:'loading',
  rows:[],
  sports:[],
  predictions:{mode:'loading',source:null,contracts:[]},
  history:{
    overall:{key:'Overall',count:0,hits:0,misses:0,hitRate:0},
    sports:[],
    legCounts:[],
    markets:[],
    sampleSize:0
  },
  historicalBets:[],
  anomalies:[]
};

function pct(n:number){return (n*100).toFixed(1)+'%'}
function money(n:number|undefined){return typeof n==='number'?'$'+n.toFixed(2):'—'}
function sourceLabel(source:string,mode:string){
  if(source==='live'&&mode==='live')return 'LIVE PROVIDER';
  if(source==='stored')return 'STORED SNAPSHOTS';
  if(source==='demo')return 'DEMO FALLBACK';
  return source.toUpperCase();
}
function dateLabel(value:string){
  if(!value)return '—';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'—':d.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}

export default function Dashboard(){
  const [view,setView]=useState<'today'|'week'>('today');
  const [limit,setLimit]=useState<30|50>(30);
  const [risk,setRisk]=useState<RiskProfile>('Moderate');
  const [board,setBoard]=useState<LiveBoardResponse>(emptyBoard);
  const [dbStats,setDbStats]=useState<DbStats>({configured:false,ok:false});
  const [calibration,setCalibration]=useState<CalibrationResponse>({source:'none',weights:[],models:[]});
  const [validationLab,setValidationLab]=useState<ValidationLabResponse|null>(null);
  const [modelDiagnostics,setModelDiagnostics]=useState<ModelDiagnosticsResponse|null>(null);
  const [modelGovernance,setModelGovernance]=useState<ModelGovernanceResponse|null>(null);
  const [releaseCertification,setReleaseCertification]=useState<ReleaseCertificationResponse|null>(null);
  const [automationHealth,setAutomationHealth]=useState<AutomationHealthResponse|null>(null);
  const [dataQuality,setDataQuality]=useState<DataQualityResponse|null>(null);
  const [edgeScanner,setEdgeScanner]=useState<NonNullable<LiveBoardResponse['edgeScanner']>|null>(null);
  const [sport,setSport]=useState('ALL');
  const [period,setPeriod]=useState<'ALL'|'AM'|'PM'>('ALL');
  const [market,setMarket]=useState('ALL');
  const [robustnessFilter,setRobustnessFilter]=useState<'ALL'|'RESILIENT'|'ROBUST'>('ALL');
  const [rankingMode,setRankingMode]=useState<'SIM'|'PRIORITY'>('SIM');
  const [divergenceFilter,setDivergenceFilter]=useState<'ALL'|'UPGRADED'|'DOWNGRADED'|'STABLE'>('ALL');
  const [reviewQueueOnly,setReviewQueueOnly]=useState(false);
  const [minSim,setMinSim]=useState(0);
  const [minOdds,setMinOdds]=useState(-1000);
  const [maxOdds,setMaxOdds]=useState(1000);
  const [parlaySize,setParlaySize]=useState(2);
  const [parlayBoard,setParlayBoard]=useState<ParlayBoardResponse|null>(null);
  const [lastError,setLastError]=useState('');
  const [bankroll,setBankroll]=useState(1000);
  const [drawdownPct,setDrawdownPct]=useState(0);
  const [portfolio,setPortfolio]=useState<PortfolioApiResponse|null>(null);
  const [selectedMarket,setSelectedMarket]=useState<{id:string;market:string;selection:string}|null>(null);
  const busy=useRef(false);

  useEffect(()=>{
    let mounted=true;
    let timer:number|undefined;
    let nextDelay=1000;
    const adaptiveLoad=async()=>{
      if(!mounted)return;
      if(!busy.current){
        busy.current=true;
        try{
          const res=await fetch('/api/live-board?view='+view+'&limit='+limit+'&risk='+risk,{cache:'no-store'});
          if(!res.ok)throw new Error('Board request failed');
          const json=await res.json() as LiveBoardResponse;
          const requested=json.liveScores?.freshness?.recommendedUiRefreshMs??json.liveScores?.uiRefreshMs??json.uiRefreshMs??1000;
          nextDelay=Math.max(500,Math.min(5000,Number(requested)||1000));
          if(mounted){setBoard(json);setLastError('')}
        }catch(error){
          nextDelay=Math.max(nextDelay,1500);
          if(mounted)setLastError(error instanceof Error?error.message:'Unable to refresh board');
        }finally{
          busy.current=false;
        }
      }
      if(mounted)timer=window.setTimeout(adaptiveLoad,nextDelay);
    };
    void adaptiveLoad();
    return ()=>{mounted=false;if(timer!==undefined)window.clearTimeout(timer)};
  },[view,limit,risk]);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const res=await fetch('/api/parlays?size=2&view='+view,{cache:'no-store'});
        if(!res.ok)return;
        const json=await res.json() as ParlayBoardResponse;
        if(mounted)setParlayBoard(json);
      }catch{}
    };
    void load();
    const timer=window.setInterval(()=>void load(),60000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[view]);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const res=await fetch('/api/db/stats',{cache:'no-store'});
        if(!res.ok)return;
        const json=await res.json() as DbStats;
        if(mounted)setDbStats(json);
      }catch{}
    };
    void load();
    const timer=window.setInterval(()=>void load(),30000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const res=await fetch('/api/intelligence/validation-lab',{cache:'no-store'});
        if(!res.ok)return;
        const json=await res.json() as ValidationLabResponse;
        if(mounted)setValidationLab(json);
      }catch{}
    };
    void load();
    const timer=window.setInterval(()=>void load(),60000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const res=await fetch('/api/intelligence/calibration',{cache:'no-store'});
        if(!res.ok)return;
        const json=await res.json() as CalibrationResponse;
        if(mounted)setCalibration(json);
      }catch{}
    };
    void load();
    const timer=window.setInterval(()=>void load(),60000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const res=await fetch('/api/intelligence/model-diagnostics',{cache:'no-store'});
        if(!res.ok)return;
        const json=await res.json() as ModelDiagnosticsResponse;
        if(mounted)setModelDiagnostics(json);
      }catch{}
    };
    void load();
    const timer=window.setInterval(()=>void load(),60000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const res=await fetch('/api/intelligence/model-governance',{cache:'no-store'});
        if(!res.ok)return;
        const json=await res.json() as ModelGovernanceResponse;
        if(mounted)setModelGovernance(json);
      }catch{}
    };
    void load();
    const timer=window.setInterval(()=>void load(),60000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const [certRes,automationRes,dataRes]=await Promise.all([
          fetch('/api/release/certify',{cache:'no-store'}),
          fetch('/api/automation/health',{cache:'no-store'}),
          fetch('/api/data-quality',{cache:'no-store'})
        ]);
        if(!mounted)return;
        if(certRes.ok)setReleaseCertification(await certRes.json() as ReleaseCertificationResponse);
        if(automationRes.ok)setAutomationHealth(await automationRes.json() as AutomationHealthResponse);
        if(dataRes.ok)setDataQuality(await dataRes.json() as DataQualityResponse);
      }catch{}
    };
    void load();
    const timer=window.setInterval(()=>void load(),60000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const res=await fetch('/api/edge-scanner',{cache:'no-store'});
        if(!res.ok)return;
        const json=await res.json() as EdgeScannerApiResponse;
        if(mounted&&json.ok&&json.result)setEdgeScanner(json.result);
      }catch{}
    };
    void load();
    const timer=window.setInterval(()=>void load(),15000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  const effectiveSport=sport==='ALL'||board.sports.includes(sport)?sport:'ALL';
  const sportCounts=useMemo(()=>board.rows.reduce<Record<string,number>>((acc,row)=>{acc[row.sport]=(acc[row.sport]||0)+1;return acc},{}),[board.rows]);
  const activeFilterCount=(effectiveSport!=='ALL'?1:0)+(period!=='ALL'?1:0)+(market!=='ALL'?1:0)+(minSim>0?1:0)+(minOdds!==-1000||maxOdds!==1000?1:0)+(robustnessFilter!=='ALL'?1:0)+(rankingMode!=='SIM'?1:0)+(divergenceFilter!=='ALL'?1:0)+(reviewQueueOnly?1:0);
  const resetBoardFilters=()=>{setSport('ALL');setPeriod('ALL');setMarket('ALL');setMinSim(0);setMinOdds(-1000);setMaxOdds(1000);setRobustnessFilter('ALL');setRankingMode('SIM');setDivergenceFilter('ALL');setReviewQueueOnly(false)};
  const fastestProviderLatency=useMemo(()=>{
    const values=(board.providerPanel||[]).map(x=>x.latencyMs).filter((x):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=0);
    return values.length?Math.min(...values):null;
  },[board.providerPanel]);

  useEffect(()=>{
    let cancelled=false;
    const load=async()=>{
      if(!board.rows.length){setPortfolio(null);return;}
      try{
        const res=await fetch('/api/portfolio/optimize',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({bankroll,drawdownPct,risk,rows:board.rows})
        });
        if(!res.ok)return;
        const json=await res.json() as PortfolioApiResponse;
        if(!cancelled)setPortfolio(json);
      }catch{}
    };
    void load();
    return ()=>{cancelled=true};
  },[board.rows,bankroll,drawdownPct,risk]);

  const marketOptions=useMemo(()=>[...new Set(board.rows.map(x=>x.market))].sort(),[board.rows]);
  const marketCounts=useMemo(()=>board.rows.reduce<Record<string,number>>((acc,row)=>{acc[row.market]=(acc[row.market]||0)+1;return acc},{}),[board.rows]);
  const applyBoardPreset=(preset:'HIGH_SIM'|'ROBUST'|'REVIEW'|'RESET')=>{
    if(preset==='RESET'){resetBoardFilters();return}
    setReviewQueueOnly(false);
    setDivergenceFilter('ALL');
    if(preset==='HIGH_SIM'){setRankingMode('SIM');setRobustnessFilter('ALL');setMinSim(70);return}
    if(preset==='ROBUST'){setRankingMode('PRIORITY');setRobustnessFilter('ROBUST');setMinSim(0);return}
    setRankingMode('PRIORITY');setRobustnessFilter('ALL');setMinSim(0);setReviewQueueOnly(true);
  };

  const robustnessMap=useMemo(()=>new Map(board.rows.map(x=>[x.id,buildBoardRobustness(x)])),[board.rows]);

  const rawFiltered=useMemo(()=>board.rows.filter(x=>{
    if(effectiveSport!=='ALL'&&x.sport!==effectiveSport)return false;
    if(period!=='ALL'&&x.period!==period)return false;
    if(market!=='ALL'&&x.market!==market)return false;
    if(x.simProbability<minSim/100)return false;
    if(x.odds<minOdds||x.odds>maxOdds)return false;
    return true;
  }),[board.rows,effectiveSport,period,market,minSim,minOdds,maxOdds]);

  const filtered=useMemo(()=>rawFiltered.filter(x=>{
    if(robustnessFilter==='ALL')return true;
    const classification=robustnessMap.get(x.id)?.classification;
    if(robustnessFilter==='ROBUST')return classification==='ROBUST';
    return classification==='ROBUST'||classification==='RESILIENT';
  }),[rawFiltered,robustnessFilter,robustnessMap]);

  const robustnessSummary=useMemo(()=>summarizeBoardRobustness(rawFiltered),[rawFiltered]);
  const priorityMap=useMemo(()=>buildBoardPriorityMap(filtered),[filtered]);
  const rankDeltas=useMemo(()=>buildBoardRankDeltas(filtered,priorityMap),[filtered,priorityMap]);
  const rankDeltaSummary=useMemo(()=>summarizeBoardRankDeltaMap(rankDeltas),[rankDeltas]);
  const reviewQueueSummary=useMemo(()=>{
    let fragile=0,fail=0,downgraded=0,total=0;
    for(const row of filtered){
      const robustness=robustnessMap.get(row.id);
      const delta=rankDeltas.get(row.id);
      if(robustness?.classification==='FRAGILE')fragile++;
      if(robustness?.classification==='FAIL')fail++;
      if(delta?.label==='DOWNGRADED')downgraded++;
      if(robustness?.reviewRequired||delta?.label==='DOWNGRADED')total++;
    }
    return {total,fragile,fail,downgraded};
  },[filtered,robustnessMap,rankDeltas]);
  const reviewReasonMap=useMemo(()=>new Map(filtered.map(row=>{
    const robustness=robustnessMap.get(row.id);
    const delta=rankDeltas.get(row.id);
    const reasons:string[]=[];
    if(robustness?.classification==='FAIL')reasons.push('robustness fail');
    else if(robustness?.classification==='FRAGILE')reasons.push('fragile robustness');
    else if(robustness?.reviewRequired)reasons.push('review required');
    if(delta?.label==='DOWNGRADED')reasons.push(`priority rank down ${Math.abs(delta.delta)}`);
    return [row.id,reasons] as const;
  })),[filtered,robustnessMap,rankDeltas]);
  const rankedFiltered=useMemo(()=>[...filtered]
    .filter(row=>divergenceFilter==='ALL'||rankDeltas.get(row.id)?.label===divergenceFilter)
    .filter(row=>!reviewQueueOnly||buildBoardRobustness(row).reviewRequired||rankDeltas.get(row.id)?.label==='DOWNGRADED')
    .sort((a,b)=>rankingMode==='PRIORITY'
      ?(priorityMap.get(b.id)?.score??0)-(priorityMap.get(a.id)?.score??0)||b.simProbability-a.simProbability
      :b.simProbability-a.simProbability),[filtered,rankingMode,divergenceFilter,reviewQueueOnly,rankDeltas,priorityMap]);
  const boardDecisionSummary=useMemo(()=>({
    visible:rankedFiltered.length,
    robust:rankedFiltered.filter(row=>robustnessMap.get(row.id)?.classification==='ROBUST').length,
    review:rankedFiltered.filter(row=>buildBoardRobustness(row).reviewRequired||rankDeltas.get(row.id)?.label==='DOWNGRADED').length,
    upgraded:rankedFiltered.filter(row=>rankDeltas.get(row.id)?.label==='UPGRADED').length,
    positiveEdge:rankedFiltered.filter(row=>row.sportsbookEdge>0).length
  }),[rankedFiltered,robustnessMap,rankDeltas]);
  const boardScanLanes=useMemo(()=>{
    const lanes={ACTION:[] as typeof rankedFiltered,WATCH:[] as typeof rankedFiltered,REVIEW:[] as typeof rankedFiltered};
    for(const row of rankedFiltered){
      const robustness=robustnessMap.get(row.id);
      const delta=rankDeltas.get(row.id);
      const needsReview=robustness?.reviewRequired||delta?.label==='DOWNGRADED';
      const decision=needsReview?'REVIEW':(row.sportsbookEdge>0&&row.dynamicConfidence>=.65?'ACTION':'WATCH');
      lanes[decision].push(row);
    }
    return lanes;
  },[rankedFiltered,robustnessMap,rankDeltas]);

  const probabilitySet=useMemo(()=>buildProbabilitySet(filtered,parlaySize,board.learnedSgpCorrelations),[filtered,parlaySize,board.learnedSgpCorrelations]);
  const mixedSet=useMemo(()=>buildMixedSportProbabilitySet(board.rows.filter(x=>x.simProbability>=minSim/100&&x.odds>=minOdds&&x.odds<=maxOdds),parlaySize,board.learnedSgpCorrelations),[board.rows,parlaySize,minSim,minOdds,maxOdds,board.learnedSgpCorrelations]);

  const amCount=filtered.filter(x=>x.period==='AM').length;
  const pmCount=filtered.filter(x=>x.period==='PM').length;
  const topGap=[...filtered].sort((a,b)=>Math.abs(b.probabilityGap)-Math.abs(a.probabilityGap)).slice(0,10);
  const predictions=[...board.predictions.contracts].sort((a,b)=>Math.abs(b.probabilityDifference)-Math.abs(a.probabilityDifference)).slice(0,12);
  const proSignals=useMemo(()=>filtered
    .map(row=>({row,signal:buildTradeSignal(row)}))
    .sort((a,b)=>b.signal.score-a.signal.score||b.signal.expectedValue-a.signal.expectedValue),[filtered]);
  const actionableSignals=proSignals.filter(x=>x.signal.action==='BUY'||x.signal.action==='BET');
  const exitSignals=proSignals.filter(x=>x.signal.action==='REDUCE');
  const watchSignals=proSignals.filter(x=>x.signal.action==='WATCH');
  const nowSignals=actionableSignals.filter(x=>x.signal.timing==='NOW');
  const crossVenueSignals=useMemo(()=>filtered
    .map(row=>({row,opportunity:findCrossVenueOpportunity(row.predictionVenueQuotes||[])}))
    .filter(x=>x.opportunity.comparableVenues>=2)
    .sort((a,b)=>b.opportunity.grossArbitrageMargin-a.opportunity.grossArbitrageMargin||b.opportunity.disagreement-a.opportunity.disagreement),[filtered]);
  const grossArbCandidates=crossVenueSignals.filter(x=>x.opportunity.grossArbitrage);
  const operatorRiskCount=(board.providerDegraded?1:0)+(automationHealth?.staleCount??0)+(automationHealth?.failedCount??0);
  const boardLoading=board.source==='loading'&&!board.generatedAt;

  return <main className="v21">
    <header className="v21Top">
      <div>
        <div className="eyebrow">EDGEFORCE AI • LIVE SPORTS INTELLIGENCE</div>
        <h1>Sports Intelligence Command Center</h1>
        <p>Live scores, sportsbook prices, player props, simulations, prediction markets and model confidence in one fast decision surface.</p>
      </div>
      <div className="v21Status">
        <span className={board.source==='live'?'dot liveDot':'dot'}/>
        <div>
          <small>{sourceLabel(board.source,board.providerMode)}</small>
          <b>{board.providerName||'Edgeforce feed'}</b>
        </div>
        <div>
          <small>UI REFRESH</small>
          <b>{Math.max(.5,(board.liveScores?.freshness?.recommendedUiRefreshMs??board.liveScores?.uiRefreshMs??board.uiRefreshMs??1000)/1000).toFixed(2).replace(/\.00$/,'')} sec</b>
        </div>
        <div>
          <small>DATA PULL</small>
          <b>{Math.round(board.sourceRefreshMs/1000)} sec cache</b>
        </div>
        <div>
          <small>FANDUEL PULSE</small>
          <b>{board.fanduelPulse?.ok?(board.fanduelPulse.fresh?'LIVE':'AGING'):'FALLBACK'}</b>
        </div>
        <div>
          <small>FASTEST FEED</small>
          <b>{fastestProviderLatency===null?'—':Math.round(fastestProviderLatency)+' ms'}</b>
        </div>
      </div>
    </header>

    <nav className="v21QuickNav" aria-label="Dashboard sections">
      <a href="#triage">Triage</a>
      <a href="#live">Live Scores</a>
      <a href="#edge">Today&apos;s Edge</a>
      <a href="#board">Probability Board</a>
      <a href="#parlays">Parlays</a>
      <a href="#predictions">Prediction Markets</a>
      <a href="#signals">Pro Signals</a>
      <a href="#research">Research + Risk</a>
      <a href="#operator">Operator Console</a>
    </nav>

    {lastError&&<div className="v21Alert">{lastError}</div>}
    {board.providerDegraded&&<div className="v21Alert">Provider degraded mode is active. {board.providerQuality?.grade?`Current payload grade: ${board.providerQuality.grade}. `:''}{board.warnings?.[0]||'Edgeforce is using a fallback source or caution-grade provider data.'}</div>}
    {board.consensusCoverage&&board.consensusCoverage.configuredFeeds>1&&board.consensusCoverage.multiBookRows===0&&<div className="v21Alert">Consensus depth is limited: multiple feeds are configured, but no displayed row currently has two distinct book prices after reconciliation.</div>}
    {board.resimulationTriggered&&<div className="v21Alert">Automatic repricing triggered for {board.resimulatedMarketIds?.length||0} market{(board.resimulatedMarketIds?.length||0)===1?'':'s'}. {(board.contextChanges||[]).slice(0,2).map(x=>x.type.replaceAll('_',' ')).join(' • ')}{board.contextRevision?` • revision ${board.contextRevision}`:''}</div>}

    {board.liveScores&&<section className="consoleCard liveScoreSurface" id="live">
      <div className="consoleHead">
        <div><div className="eyebrow">LIVE GAME CLOCK MESH</div><h3>{board.liveScores.liveGames} game{board.liveScores.liveGames===1?'':'s'} live now</h3></div>
        <div className="consoleSource">{Math.round(board.liveScores.refreshMs/1000)}s source cache • {board.liveScores.freshness?.state||'ACTIVE'} • {Math.max(.5,(board.liveScores.freshness?.recommendedUiRefreshMs??board.liveScores.uiRefreshMs??1000)/1000).toFixed(2).replace(/\.00$/,'')}s UI • {board.liveScores.consensus?Math.round(board.liveScores.consensus.corroborationRate*100)+'% corroborated':'consensus warming'}</div>
      </div>
      <div className="liveScoreGrid">
        {(board.liveScores.games||[]).filter(g=>g.status==='LIVE').slice(0,12).map(g=><article className="liveScoreCard" key={g.source+'-'+g.id}>
          <div className="liveScoreCardHead"><span className="action action-open">{g.league}</span><span className={g.consensus?.activeConflict?'orange':'lime'}>{g.consensus?.activeConflict?'CONFLICT':(g.consensus?.confidence||'LIVE')}</span></div>
          <div className="liveScoreTeams">
            <div><b>{g.away.name}</b><strong>{g.away.score??'—'}</strong></div>
            <div><b>{g.home.name}</b><strong>{g.home.score??'—'}</strong></div>
          </div>
          <div className="liveScoreMeta"><b>{[g.period,g.clock&&('Clock '+g.clock)].filter(Boolean).join(' • ')||g.detail}</b><small>{[g.source,g.consensus&&((g.consensus.confidence==='SINGLE_SOURCE'?'1 source':g.consensus.sourceCount+' sources')+' • '+g.consensus.confidence+' confidence'),g.consensus?.laggingSources?.length&&('lagging '+g.consensus.laggingSources.join(','))].filter(Boolean).join(' • ')}</small></div>
        </article>)}
      </div>
      {!board.liveScores.liveGames&&<p className="emptyState">No supported games are live at this moment. The score mesh remains active for scheduled starts and finals.</p>}
    </section>}

    <section className="v21Hero">
      <div>
        <div className="badge">ALL SPORTS • LIVE SCORES • PLAYER PROPS • +EV • PARLAYS • PREDICTION MARKETS</div>
        <h2>Find the strongest <em>edges first.</em></h2>
        <p>EdgeForce ranks every qualified market by simulation probability, confidence, price, consensus and context so the best current opportunities rise to the top.</p>
      </div>
      <div className="v21HeroCard">
        <small>CURRENT BOARD</small>
        <strong>{boardLoading?'—':filtered.length}</strong>
        <span>{boardLoading?'loading live board':'filtered legs'}</span>
        <div className="v21MiniGrid">
          <div><small>AM</small><b>{amCount}</b></div>
          <div><small>PM</small><b>{pmCount}</b></div>
          <div><small>Sports</small><b>{board.sports.length}</b></div>
          <div><small>History</small><b>{board.history.sampleSize}</b></div>
          <div><small>Feed</small><b>{board.providerDegraded?'DEGRADED':board.providerQuality?.grade||'READY'}</b></div>
          <div><small>Feeds</small><b>{board.consensusCoverage?.acceptedFeeds??1}</b></div>
          <div><small>Multi-book</small><b>{board.consensusCoverage?.multiBookRows??0}</b></div>
          <div><small>Price shops</small><b>{board.consensusCoverage?.priceShopOpportunities??0}</b></div>
          <div><small>Arbs</small><b>{edgeScanner?.arbitrageCount??0}</b></div>
          <div><small>+EV</small><b>{edgeScanner?.positiveEvCount??0}</b></div>
          <div><small>Sharp ref</small><b>{edgeScanner?.sharpReferenceGroups??0}</b></div>
          <div><small>Stable</small><b>{board.regimeCoverage?.stable??0}</b></div>
          <div><small>Dislocated</small><b>{board.regimeCoverage?.dislocated??0}</b></div>
          <div><small>High conf</small><b>{board.regimeCoverage?.highConfidence??0}</b></div>
          <div><small>Avg conf</small><b>{board.regimeCoverage?fmtPct(board.regimeCoverage.averageDynamicConfidence):'—'}</b></div>
          <div><small>Context ready</small><b>{board.contextDiagnostics?.qualitySummary?.recommendationReadyRows??0}</b></div>
          <div><small>Context avg</small><b>{board.contextDiagnostics?.qualitySummary?fmtPct(board.contextDiagnostics.qualitySummary.averageCoverage):'—'}</b></div>
          <div><small>Live context</small><b>{board.contextDiagnostics?.publicNetwork?.matchedEvents??0}</b></div>
          <div><small>Data audit</small><b>{dataQuality?.audit?.grade||'—'}</b></div>
          <div><small>Automation</small><b>{automationHealth?(automationHealth.healthy?'HEALTHY':automationHealth.failedCount?'FAILED':automationHealth.staleCount?'STALE':'PENDING'):'—'}</b></div>
          <div><small>Validation</small><b>{validationLab?.report?.evidence?.promotionEligible??0}</b></div>
          <div><small>Brier skill</small><b>{validationLab?.report?.sampleSize?fmtPct(validationLab.report.overall.brierSkillScore):'—'}</b></div>
          <div><small>Release cert</small><b>{releaseCertification?.latest?(releaseCertification.latest.certified?'CERTIFIED':'BLOCKED'):'AWAITING'}</b></div>
        </div>
      </div>
    </section>

    <section className="sportNavigator" aria-label="Sport navigation">
      <div className="sportNavigatorHead">
        <div><div className="eyebrow">V188 SPORT NAVIGATOR</div><h3>Jump straight to a sport</h3></div>
        <button className="filterReset" onClick={resetBoardFilters} disabled={activeFilterCount===0}>{activeFilterCount?`Reset ${activeFilterCount} filter${activeFilterCount===1?'':'s'}`:'No active filters'}</button>
      </div>
      <div className="sportChipRail">
        <button className={effectiveSport==='ALL'?'active':''} aria-pressed={effectiveSport==='ALL'} onClick={()=>setSport('ALL')}><b>All sports</b><span>{board.rows.length}</span></button>
        {board.sports.map(x=><button key={'sport-chip-'+x} className={effectiveSport===x?'active':''} aria-pressed={effectiveSport===x} onClick={()=>setSport(x)}><b>{x}</b><span>{sportCounts[x]||0}</span></button>)}
      </div>
      <div className="filterSummary" aria-live="polite">
        <span>{effectiveSport==='ALL'?'All sports':effectiveSport}</span>
        <span>{period==='ALL'?'All day':period}</span>
        <span>{market==='ALL'?'All markets':market}</span>
        <span>{rankingMode==='SIM'?'Highest simulation':'Robustness-aware'}</span>
        {reviewQueueOnly&&<span>Review queue</span>}
      </div>
    </section>

    <section className="marketCommandBar" aria-label="Market and preset controls">
      <div className="marketCommandHead">
        <div><div className="eyebrow">V190 MARKET COMMAND BAR</div><h3>Preset the board, then drill into a market</h3></div>
        <div className="presetRail" aria-label="Board presets">
          <button onClick={()=>applyBoardPreset('HIGH_SIM')}>High Sim</button>
          <button onClick={()=>applyBoardPreset('ROBUST')}>Robust</button>
          <button onClick={()=>applyBoardPreset('REVIEW')}>Review</button>
          <button onClick={()=>applyBoardPreset('RESET')}>Reset</button>
        </div>
      </div>
      <div className="marketChipRail" aria-label="Market shortcuts">
        <button className={market==='ALL'?'active':''} aria-pressed={market==='ALL'} onClick={()=>setMarket('ALL')}><b>All markets</b><span>{board.rows.length}</span></button>
        {marketOptions.map(x=><button key={'market-chip-'+x} className={market===x?'active':''} aria-pressed={market===x} onClick={()=>setMarket(x)}><b>{x}</b><span>{marketCounts[x]||0}</span></button>)}
      </div>
      <div className="presetSummary" aria-live="polite">
        <span>{minSim?('Sim '+minSim+'%+'):'Any sim'}</span>
        <span>{robustnessFilter==='ALL'?'Any robustness':robustnessFilter}</span>
        <span>{reviewQueueOnly?'Review queue':'Normal queue'}</span>
        <span>{rankingMode==='PRIORITY'?'Priority order':'Sim order'}</span>
      </div>
    </section>

    <details className="advancedBoardFilters">
      <summary>
        <div><div className="eyebrow">ADVANCED FILTERS</div><b>Fine-tune board controls</b></div>
        <span>{activeFilterCount} active</span>
      </summary>
      <section className="v21ControlPanel">
        <div className="controlGroup">
          <label>Board</label>
          <div className="segmented">
            <button className={view==='today'?'active':''} onClick={()=>setView('today')}>Today</button>
            <button className={view==='week'?'active':''} onClick={()=>setView('week')}>7-Day</button>
          </div>
        </div>
        <div className="controlGroup">
          <label>Rows</label>
          <div className="segmented">
            <button className={limit===30?'active':''} onClick={()=>setLimit(30)}>30</button>
            <button className={limit===50?'active':''} onClick={()=>setLimit(50)}>50</button>
          </div>
        </div>
        <div className="controlGroup">
          <label>Risk model</label>
          <select value={risk} onChange={e=>setRisk(e.target.value as RiskProfile)}>
            <option>Conservative</option>
            <option>Moderate</option>
            <option>Aggressive</option>
          </select>
        </div>
        <div className="controlGroup">
          <label>V120 robustness</label>
          <select value={robustnessFilter} onChange={e=>setRobustnessFilter(e.target.value as 'ALL'|'RESILIENT'|'ROBUST')}>
            <option value="ALL">All qualified</option>
            <option value="RESILIENT">Resilient+</option>
            <option value="ROBUST">Robust only</option>
          </select>
        </div>
        <div className="controlGroup">
          <label>V121 ranking</label>
          <select value={rankingMode} onChange={e=>setRankingMode(e.target.value as 'SIM'|'PRIORITY')}>
            <option value="SIM">Highest simulation</option>
            <option value="PRIORITY">Robustness-aware</option>
          </select>
        </div>
        <div className="controlGroup">
          <label>V129 movement</label>
          <select value={divergenceFilter} onChange={e=>setDivergenceFilter(e.target.value as 'ALL'|'UPGRADED'|'DOWNGRADED'|'STABLE')}>
            <option value="ALL">All movement</option>
            <option value="UPGRADED">Upgraded only</option>
            <option value="DOWNGRADED">Downgraded only</option>
            <option value="STABLE">Stable only</option>
          </select>
        </div>
        <div className="controlGroup">
          <label>V182 review queue</label>
          <div className="segmented">
            <button className={!reviewQueueOnly?'active':''} onClick={()=>setReviewQueueOnly(false)}>All</button>
            <button className={reviewQueueOnly?'active':''} onClick={()=>setReviewQueueOnly(true)}>Review {reviewQueueSummary.total}</button>
          </div>
        </div>
        <div className="controlGroup">
          <label>Sport</label>
          <select value={effectiveSport} onChange={e=>setSport(e.target.value)}>
            <option value="ALL">All sports</option>
            {board.sports.map(x=><option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="controlGroup">
          <label>Time</label>
          <select value={period} onChange={e=>setPeriod(e.target.value as 'ALL'|'AM'|'PM')}>
            <option value="ALL">All day</option>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
        <div className="controlGroup">
          <label>Market</label>
          <select value={market} onChange={e=>setMarket(e.target.value)}>
            <option value="ALL">All markets</option>
            {marketOptions.map(x=><option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="controlGroup">
          <label>Minimum sim %</label>
          <input type="number" min="0" max="99" value={minSim} onChange={e=>setMinSim(Math.max(0,Math.min(99,Number(e.target.value)||0)))}/>
        </div>
        <div className="controlGroup double">
          <label>American odds range</label>
          <div className="rangePair">
            <input type="number" value={minOdds} onChange={e=>setMinOdds(Number(e.target.value)||-1000)}/>
            <span>to</span>
            <input type="number" value={maxOdds} onChange={e=>setMaxOdds(Number(e.target.value)||1000)}/>
          </div>
        </div>
      </section>
    </details>

    <section className="v21Stats">
      <div><small>{rankingMode==='PRIORITY'?'TOP PRIORITY':'TOP SIM'}</small><strong>{rankedFiltered[0]?fmtPct(rankingMode==='PRIORITY'?buildBoardPriority(rankedFiltered[0]).score:rankedFiltered[0].simProbability):'—'}</strong><span>{rankedFiltered[0]?.selection||'No current row'}</span></div>
      <div><small>AVG SIM</small><strong>{filtered.length?fmtPct(filtered.reduce((s,x)=>s+x.simProbability,0)/filtered.length):'—'}</strong><span>filtered board</span></div>
      <div><small>AVG CONSENSUS</small><strong>{filtered.length?fmtPct(filtered.reduce((s,x)=>s+x.noVigProbability,0)/filtered.length):'—'}</strong><span>{board.consensusCoverage?.averageAgreement!==undefined?`${fmtPct(board.consensusCoverage.averageAgreement)} avg agreement`:'cross-book baseline'}</span></div>
      <div><small>DYNAMIC CONF</small><strong>{filtered.length?fmtPct(filtered.reduce((sum,x)=>sum+x.dynamicConfidence,0)/filtered.length):'—'}</strong><span>{board.regimeCoverage?.dislocated??0} dislocated • {board.regimeCoverage?.volatile??0} volatile</span></div>
      <div><small>V120 ROBUSTNESS</small><strong>{rawFiltered.length?fmtPct(robustnessSummary.averageScore):'—'}</strong><span>{robustnessSummary.robust} robust • {robustnessSummary.reviewRequired} review • 0 extra calls</span></div>
      <div><small>V127 DIVERGENCE</small><strong>{rankDeltaSummary.upgraded+rankDeltaSummary.downgraded}</strong><span>{rankDeltaSummary.upgraded} up • {rankDeltaSummary.downgraded} down • {rankDeltaSummary.stable} stable</span></div>
      <div><small>V182 REVIEW QUEUE</small><strong>{reviewQueueSummary.total}</strong><span>{reviewQueueSummary.fragile} fragile • {reviewQueueSummary.fail} fail • {reviewQueueSummary.downgraded} down</span></div>
    </section>

    <section className="consoleCard operatorTriage" id="triage">
      <div className="consoleHead">
        <div><div className="eyebrow">V186 OPERATOR TRIAGE</div><h3>Decision state at a glance</h3><p>One surface for board quality, review pressure, actionable signals and operating health.</p></div>
        <div className="triageStatusStack">
          <span className="triageStatus">{releaseCertification?.latest?.certified?'CERTIFIED':'AWAITING CERT'}</span>
          <span className="consoleSource">LOCAL BOARD SIGNALS • 0 EXTRA CALLS</span>
        </div>
      </div>
      <div className="edgeCommandPulse">
        <div><small>ROBUST</small><b>{robustnessSummary.robust}</b></div>
        <div><small>REVIEW</small><b>{reviewQueueSummary.total}</b></div>
        <div><small>DOWNGRADED</small><b>{rankDeltaSummary.downgraded}</b></div>
        <div><small>+EV</small><b>{edgeScanner?.positiveEvCount??0}</b></div>
        <div><small>NOW SIGNALS</small><b>{nowSignals.length}</b></div>
        <div><small>OPS FLAGS</small><b>{operatorRiskCount}</b></div>
      </div>
      <div className="segmented">
        <button className={reviewQueueOnly?'active':''} onClick={()=>{setReviewQueueOnly(true);setDivergenceFilter('ALL')}}>Focus review</button>
        <button className={robustnessFilter==='ROBUST'?'active':''} onClick={()=>{setReviewQueueOnly(false);setRobustnessFilter('ROBUST');setDivergenceFilter('ALL')}}>Robust only</button>
        <button className={divergenceFilter==='DOWNGRADED'?'active':''} onClick={()=>{setReviewQueueOnly(false);setDivergenceFilter('DOWNGRADED')}}>Downgraded</button>
        <button onClick={()=>{setReviewQueueOnly(false);setRobustnessFilter('ALL');setDivergenceFilter('ALL')}}>Reset triage</button>
      </div>
    </section>

    <section className="edgeCommand" id="edge">
      <div className="edgeCommandHead">
        <div>
          <div className="eyebrow">TODAY&apos;S EDGE</div>
          <h2>Highest-priority opportunities now</h2>
          <p>Fast view only. Every item remains model-based decision support, not a guarantee.</p>
        </div>
        <div className="edgeCommandPulse">
          <span className={board.source==='live'?'dot liveDot':'dot'}/>
          <div><small>BOARD</small><b>{board.source==='live'?'LIVE':'WARMING'}</b></div>
          <div><small>QUALIFIED</small><b>{boardLoading?'—':filtered.length}</b></div>
          <div><small>+EV</small><b>{edgeScanner?.positiveEvCount??0}</b></div>
          <div><small>ARBS</small><b>{edgeScanner?.arbitrageCount??0}</b></div>
          <div><small>ROBUST</small><b>{robustnessSummary.robust}</b></div>
          <div><small>REVIEW</small><b>{robustnessSummary.reviewRequired}</b></div>
        </div>
      </div>

      <div className="edgeCommandGrid">
        <article className="edgeLane">
          <div className="edgeLaneHead">
            <div><small>TOP SIMULATIONS</small><h3>Best ranked legs</h3></div>
            <span>{effectiveSport==='ALL'?'ALL SPORTS':effectiveSport}</span>
          </div>
          <div className="edgeRows">
            {rankedFiltered.slice(0,5).map((x,i)=><button className="edgeRow" key={'fast-'+x.id} onClick={()=>setSelectedMarket({id:x.id,market:x.market,selection:x.selection})}>
              <span className="edgeRank">{i+1}</span>
              <div className="edgeRowMain">
                <b>{x.selection}</b>
                <small>{x.sport} • {x.event} • {x.market}</small>
              </div>
              <div className="edgeMetric"><strong>{fmtPct(rankingMode==='PRIORITY'?buildBoardPriority(x).score:x.simProbability)}</strong><small>{rankingMode==='PRIORITY'?'PRIORITY':'SIM'}</small></div>
              <div className="edgePrice"><strong>{fmtOdds(x.odds)}</strong><small>{x.confidenceLabel} • {robustnessMap.get(x.id)?.classification||'—'}</small>{rankingMode==='PRIORITY'&&<small>{buildBoardPriority(x).explanation.slice(0,3).join(' • ')}</small>}{rankingMode==='PRIORITY'&&rankDeltas.get(x.id)&&<small>V126 {rankDeltas.get(x.id)?.label} • {rankDeltas.get(x.id)?.delta===0?'same rank':`${Math.abs(rankDeltas.get(x.id)?.delta||0)} place${Math.abs(rankDeltas.get(x.id)?.delta||0)===1?'':'s'} ${(rankDeltas.get(x.id)?.delta||0)>0?'up':'down'}`}</small>}{reviewQueueOnly&&reviewReasonMap.get(x.id)?.length?<small>V184 REVIEW • {reviewReasonMap.get(x.id)?.join(' • ')}</small>:null}</div>
            </button>)}
            {!filtered.length&&<div className="edgeEmpty">No qualified simulation rows under the current filters.</div>}
          </div>
        </article>

        <article className="edgeLane">
          <div className="edgeLaneHead">
            <div><small>LOCAL EDGE SCANNER</small><h3>+EV and arbitrage</h3></div>
            <span>0 EXTRA CALLS</span>
          </div>
          <div className="edgeRows">
            {(edgeScanner?.positiveEv||[]).slice(0,4).map((x,i)=><div className="edgeRow static" key={'ev-'+x.key+'-'+x.selection}>
              <span className="edgeRank">+{i+1}</span>
              <div className="edgeRowMain">
                <b>{x.selection}</b>
                <small>{x.sport} • {x.event} • {x.book} {fmtOdds(x.odds)}</small>
              </div>
              <div className="edgeMetric"><strong>+{fmtPct(x.expectedValue)}</strong><small>EV</small></div>
              <div className="edgePrice"><strong>{fmtPct(x.fairProbability)}</strong><small>FAIR</small></div>
            </div>)}
            {(edgeScanner?.arbitrage||[]).slice(0,1).map(x=><div className="edgeRow static arb" key={'arb-'+x.key}>
              <span className="edgeRank">A</span>
              <div className="edgeRowMain">
                <b>{x.event}</b>
                <small>{x.market} • {x.outcomeCount} outcomes</small>
              </div>
              <div className="edgeMetric"><strong>+{fmtPct(x.roi)}</strong><small>ARB ROI</small></div>
              <div className="edgePrice"><strong>{x.stakePlan.length}</strong><small>LEGS</small></div>
            </div>)}
            {!edgeScanner?.positiveEv?.length&&!edgeScanner?.arbitrage?.length&&<div className="edgeEmpty">Scanner is healthy. No validated +EV or arbitrage opportunity clears the current safety gates.</div>}
          </div>
        </article>

        <article className="edgeLane">
          <div className="edgeLaneHead">
            <div><small>PARLAY ENGINE</small><h3>Best qualified build</h3></div>
            <span>{parlayBoard?.recommendationStatus?.replaceAll('_',' ')||'LOADING'}</span>
          </div>
          {parlayBoard?.recommended?.[0]?<div className="featuredParlay">
            <div className="featuredParlayScore">
              <small>JOINT MODEL</small>
              <strong>{fmtPct(parlayBoard.recommended[0].combinedProbability)}</strong>
              <span>{fmtOdds(parlayBoard.recommended[0].combinedAmericanOdds)} combined</span>
            </div>
            <div className="featuredParlayLegs">
              {parlayBoard.recommended[0].legs.slice(0,6).map((leg,i)=><div key={leg.id}>
                <span>{i+1}</span>
                <div><b>{leg.selection}</b><small>{leg.sport} • {fmtPct(leg.simProbability)} sim</small></div>
              </div>)}
            </div>
            <div className="featuredParlayFoot">
              <span>EV {parlayBoard.recommended[0].expectedValue>=0?'+':''}{fmtPct(parlayBoard.recommended[0].expectedValue)}</span>
              <span>Confidence {fmtPct(parlayBoard.recommended[0].averageDynamicConfidence)}</span>
            </div>
          </div>:<div className="edgeEmpty large">No normal parlay currently clears every recommendation gate. EdgeForce will not promote a watchlist or longshot combination into this slot.</div>}
        </article>
      </div>
    </section>

    <section className="v21Panel" id="board">
      <div className="v21PanelHead">
        <div>
          <div className="eyebrow">{view==='today'?'TODAY PROBABILITY BOARD':'WEEKLY SPREAD BOARD'}</div>
          <h3>{view==='today'?(rankingMode==='PRIORITY'?'Robustness-aware priority first':'Highest simulation probability first'):'Probability score distributed across the week'}</h3>
        </div>
        <div className="panelMeta">
          <span>{rankedFiltered.length} shown • {board.topBoardQualification?.withheld??0} withheld</span>
          <span>{board.topBoardQualification?.forced===false?'QUALITY ONLY • NOT FORCED':'loading qualification'}</span>
          <span>{board.generatedAt?dateLabel(board.generatedAt):'loading'}</span>
        </div>
      </div>
      <div className="boardDecisionStrip" aria-label="Probability board decision summary">
        <div><small>VISIBLE</small><b>{boardDecisionSummary.visible}</b></div>
        <div><small>ROBUST</small><b>{boardDecisionSummary.robust}</b></div>
        <div><small>REVIEW</small><b>{boardDecisionSummary.review}</b></div>
        <div><small>UPGRADED</small><b>{boardDecisionSummary.upgraded}</b></div>
        <div><small>+ EDGE</small><b>{boardDecisionSummary.positiveEdge}</b></div>
        <div><small>ORDER</small><b>{rankingMode==='PRIORITY'?'PRIORITY':'SIM'}</b></div>
      </div>
      <div className="boardScanDock" aria-label="V191 board scan controls">
        <div className="boardScanMode">
          <div><small>V191 LIVE SCAN</small><b>Action-first board</b></div>
          <div className="segmented">
            <button className={rankingMode==='SIM'?'active':''} onClick={()=>setRankingMode('SIM')}>Sim</button>
            <button className={rankingMode==='PRIORITY'?'active':''} onClick={()=>setRankingMode('PRIORITY')}>Priority</button>
            <button className={robustnessFilter==='ROBUST'?'active':''} onClick={()=>{setRobustnessFilter(robustnessFilter==='ROBUST'?'ALL':'ROBUST');setReviewQueueOnly(false)}}>Robust</button>
            <button className={reviewQueueOnly?'active':''} onClick={()=>{setReviewQueueOnly(!reviewQueueOnly);if(!reviewQueueOnly)setRobustnessFilter('ALL')}}>Review</button>
          </div>
        </div>
        <div className="boardScanLanes">
          {(['ACTION','WATCH','REVIEW'] as const).map(lane=>{const row=boardScanLanes[lane][0];return <button key={lane} className={'boardScanLane '+lane.toLowerCase()} onClick={()=>row&&setSelectedMarket({id:row.id,market:row.market,selection:row.selection})} disabled={!row}>
            <span><small>{lane}</small><b>{boardScanLanes[lane].length}</b></span>
            <span><strong>{row?.selection||'No rows'}</strong><small>{row?fmtPct(row.simProbability)+' sim • '+fmtOdds(row.odds):'No current candidate'}</small></span>
          </button>})}
        </div>
      </div>
      <div className="mobileBoardCards">
        {rankedFiltered.map((x,i)=>{const r=robustnessMap.get(x.id);const delta=rankDeltas.get(x.id);const needsReview=r?.reviewRequired||delta?.label==='DOWNGRADED';const decision=needsReview?'REVIEW':(x.sportsbookEdge>0&&x.dynamicConfidence>=.65?'ACTION':'WATCH');return <article className={'mobileBoardCard decision-'+decision.toLowerCase()} key={'mobile-'+x.id}>
          <div className="mobileBoardTop"><span className="edgeRank">{i+1}</span><span className="sportPill">{x.sport}</span><span className={'decisionBadge '+decision.toLowerCase()}>{decision}</span><span className={'grade '+x.grade.toLowerCase()}>{x.grade}</span></div>
          <div className="mobileBoardMain"><b>{x.selection}</b><small>{x.event} • {x.market} • {x.period}</small></div>
          <div className="mobileBoardMetrics">
            <div><small>SIM</small><strong className="lime">{fmtPct(x.simProbability)}</strong></div>
            <div><small>ODDS</small><strong>{fmtOdds(x.odds)}</strong></div>
            <div><small>CONF</small><strong>{fmtPct(x.dynamicConfidence)}</strong></div>
            <div><small>EDGE</small><strong className={x.sportsbookEdge>=0?'lime':'negative'}>{x.sportsbookEdge>=0?'+':''}{fmtPct(x.sportsbookEdge)}</strong></div>
          </div>
          <div className="mobileBoardFoot"><span className={'robustnessBadge '+(r?.classification||'FAIL').toLowerCase()}>{r?.classification||'—'}</span><span>{x.bestExecutionVenue?.venue||board.targetBook||'—'}</span><button className="ackBtn" onClick={()=>setSelectedMarket({id:x.id,market:x.market,selection:x.selection})}>EXPLAIN</button></div>
        </article>})}
        {!rankedFiltered.length&&<div className="edgeEmpty">No qualified rows match the current ranking and review filters.</div>}
      </div>
      <div className="tableWrap desktopBoardTable">
        <table className="v21Table">
          <thead><tr>
            <th>#</th><th>Sport</th><th>Event / Selection</th><th>Time</th><th>Market</th><th>Odds</th><th>Raw %</th><th>Consensus %</th><th>PM %</th><th>Sim %</th><th>Confidence</th><th>Robustness</th><th>Target Edge</th><th>PM Edge</th><th>Best Venue</th><th>1/4 Kelly</th><th>Engine</th><th>Sims</th><th>Grade</th>
          </tr></thead>
          <tbody>
            {rankedFiltered.map((x,i)=>{const r=robustnessMap.get(x.id);const delta=rankDeltas.get(x.id);const needsReview=r?.reviewRequired||delta?.label==='DOWNGRADED';const decision=needsReview?'REVIEW':(x.sportsbookEdge>0&&x.dynamicConfidence>=.65?'ACTION':'WATCH');return <tr className={'decisionRow decision-'+decision.toLowerCase()} key={x.id}>
              <td className="rankCell">{i+1}</td>
              <td><span className="sportPill">{x.sport}</span></td>
              <td><b>{x.event}</b><small>{x.selection}</small></td>
              <td><b>{x.period}</b><small>{dateLabel(x.startTime)}</small></td>
              <td>{x.market}</td>
              <td><b>{fmtOdds(x.odds)}</b><small>{x.consensus?`${x.consensus.targetBookFound?x.consensus.targetBook:'target missing'} • best ${fmtOdds(x.consensus.bestOdds)} ${x.consensus.bestBook||''}`:x.sourceBook||board.targetBook||'single source'}</small><small>{x.lineMovement?('open '+fmtOdds(x.lineMovement.openerOdds)+' • '+x.lineMovement.direction+(x.lineMovement.steam?' • '+x.lineMovement.steamStrength+' STEAM':'')):'no history'}</small></td>
              <td>{fmtPct(x.rawImpliedProbability)}</td>
              <td><b>{fmtPct(x.noVigProbability)}</b><small>{x.consensus?`${x.consensus.bookCount} books • ${fmtPct(x.consensus.agreement)} agree • ${x.consensus.marketStructure.replaceAll('_',' ')}`:'single-source baseline'}</small></td>
              <td><b>{x.predictionMarketProbability!==undefined?fmtPct(x.predictionMarketProbability):'—'}</b><small>{x.predictionMarketStatus==='MATCHED'?(x.predictionMarketVolume!==undefined?`vol ${Math.round(x.predictionMarketVolume).toLocaleString()}`:'matched'):x.predictionMarketStatus.replaceAll('_',' ')}</small></td>
              <td className="lime"><b>{fmtPct(x.simProbability)}</b><small>raw {fmtPct(x.rawSimProbability)} • CI {fmtPct(x.simCi[0])}–{fmtPct(x.simCi[1])}</small></td>
              <td><b>{fmtPct(x.dynamicConfidence)}</b><small>{x.confidenceLabel} • {x.regime}</small></td>
              <td>{(()=>{const r=robustnessMap.get(x.id);return r?<><span className={'robustnessBadge '+r.classification.toLowerCase()}>{r.classification}</span><small>{fmtPct(r.score)}{r.reasons[0]?` • ${r.reasons[0]}`:''}</small></>:<span>—</span>})()}</td>
              <td className={x.sportsbookEdge>=0?'lime':'negative'}>{x.sportsbookEdge>=0?'+':''}{fmtPct(x.sportsbookEdge)}</td>
              <td className={(x.predictionEdge??0)>=0?'lime':'negative'}>{x.predictionEdge===undefined?'—':`${x.predictionEdge>=0?'+':''}${fmtPct(x.predictionEdge)}`}</td>
              <td><b>{x.bestExecutionVenue?.venue||'—'}</b><small>{x.bestExecutionVenue?`${x.bestExecutionVenue.type.replaceAll('_',' ')} • EV ${x.bestExecutionVenue.expectedValue>=0?'+':''}${fmtPct(x.bestExecutionVenue.expectedValue)}${x.bestExecutionVenue.feeAdjusted?'':' • gross before fees'}`:'no route'}</small></td>
              <td>{fmtPct(x.quarterKelly)}</td>
              <td><b>{x.simEngine.replaceAll('_',' ')}</b><small>{x.simProjection.microUnit?`${x.simProjection.microUnitCount?.toFixed(1)??'—'} ${x.simProjection.microUnit} avg • p10 ${x.simProjection.p10?.toFixed(1)??'—'} • p50 ${x.simProjection.p50?.toFixed(1)??'—'} • p90 ${x.simProjection.p90?.toFixed(1)??'—'}`:x.simProjection.distributionFamily?`${x.simProjection.distributionFamily} • p10 ${x.simProjection.p10?.toFixed(1)??'—'} • p50 ${x.simProjection.p50?.toFixed(1)??'—'} • p90 ${x.simProjection.p90?.toFixed(1)??'—'}`:(x.playerContext?`${x.playerContext.name}${x.playerContext.status?` • ${x.playerContext.status}`:''}${x.playerContext.starter===false?' • not starting':''}`:(x.simProjection.unit?`${x.simProjection.totalMean!==undefined?x.simProjection.totalMean.toFixed(1):x.simProjection.selectionMean!==undefined?x.simProjection.selectionMean.toFixed(1):''} ${x.simProjection.unit}`:''))}</small></td>
              <td>{x.simulationRuns.toLocaleString()}</td>
              <td><span className={'decisionBadge '+decision.toLowerCase()}>{decision}</span><span className={'grade '+x.grade.toLowerCase()}>{x.grade}</span><button className="ackBtn" onClick={()=>setSelectedMarket({id:x.id,market:x.market,selection:x.selection})}>EXPLAIN</button></td>
            </tr>})}
            {!rankedFiltered.length&&<tr><td colSpan={19} className="emptyRow">No qualified rows match the current ranking and review filters. Edgeforce will not pad the board with lower-grade plays.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div>
          <div className="eyebrow">V51 EVIDENCE-GATED RECOMMENDATIONS</div>
          <h3>Recommended, Value Watchlist and Hail Mary are separated by risk gates</h3>
        </div>
        <div className="panelMeta">
          <span>{parlayBoard?.recommendationStatus?.replaceAll('_',' ')||'LOADING'}</span>
          <span>{parlayBoard?.generatedParlayCandidates??0} combinations scored</span>
          <span>{parlayBoard?.rejectedParlayCandidates??0} rejected</span>
        </div>
      </div>
      <div className="v21Grid three">
        <div className="v21Card">
          <div className="v21CardHead"><div><div className="eyebrow">RECOMMENDED</div><h3>{parlayBoard?.recommended.length??0} qualified</h3></div><span className="miniBadge">≥ {parlayBoard?fmtPct(parlayBoard.thresholds.recommendedMinJoint):'52.0%'} joint</span></div>
          <div className="historyList">
            {(parlayBoard?.recommended||[]).slice(0,3).map((p,i)=><div className="historyRow" key={p.id}><span>#{i+1} {p.legs.map(x=>x.selection).join(' + ')}</span><b>{fmtPct(p.combinedProbability)}</b><small>{fmtOdds(p.combinedAmericanOdds)} • EV {p.expectedValue>=0?'+':''}{fmtPct(p.expectedValue)} • conf {fmtPct(p.averageDynamicConfidence)}</small></div>)}
            {!parlayBoard?.recommended.length&&<div className="historyRow"><span>No normal recommendation clears every gate</span><b>HOLD</b><small>Edgeforce will not promote watchlist or longshot combinations into this tier.</small></div>}
          </div>
        </div>
        <div className="v21Card">
          <div className="v21CardHead"><div><div className="eyebrow">VALUE WATCHLIST</div><h3>{parlayBoard?.valueWatchlist.length??0} monitored</h3></div><span className="miniBadge">positive EV</span></div>
          <div className="historyList">
            {(parlayBoard?.valueWatchlist||[]).slice(0,3).map((p,i)=><div className="historyRow" key={p.id}><span>#{i+1} {p.legs.map(x=>x.selection).join(' + ')}</span><b>{fmtPct(p.combinedProbability)}</b><small>{fmtOdds(p.combinedAmericanOdds)} • {p.riskFlags.slice(0,2).map(x=>x.replaceAll('_',' ')).join(' • ')}</small></div>)}
            {!parlayBoard?.valueWatchlist.length&&<div className="historyRow"><span>No current value-watch combinations</span><b>—</b><small>Watchlist requires positive modeled value without longshot-grade risk.</small></div>}
          </div>
        </div>
        <div className="v21Card">
          <div className="v21CardHead"><div><div className="eyebrow">HAIL MARY</div><h3>{parlayBoard?.hailMary.length??0} isolated</h3></div><span className="miniBadge">longshot only</span></div>
          <div className="historyList">
            {(parlayBoard?.hailMary||[]).slice(0,3).map((p,i)=><div className="historyRow" key={p.id}><span>#{i+1} {p.legs.map(x=>x.selection).join(' + ')}</span><b>{fmtPct(p.combinedProbability)}</b><small>{fmtOdds(p.combinedAmericanOdds)} • {p.riskFlags.slice(0,2).map(x=>x.replaceAll('_',' ')).join(' • ')}</small></div>)}
            {!parlayBoard?.hailMary.length&&<div className="historyRow"><span>No isolated longshots</span><b>—</b><small>Extreme underdogs and high-divergence combinations stay out of the normal board.</small></div>}
          </div>
        </div>
      </div>
    </section>

    <section className="v21Grid two" id="parlays">
      <div className="v21Card">
        <div className="v21CardHead">
          <div><div className="eyebrow">PARLAY LEG FILTER</div><h3>Probability set</h3></div>
          <select value={parlaySize} onChange={e=>setParlaySize(Number(e.target.value))}>
            {Array.from({length:19},(_,i)=>i+2).map(n=><option value={n} key={n}>{n} legs</option>)}
          </select>
        </div>
        {probabilitySet?<div className="setBody">
          <div className="setScore"><small>JOINT MODEL %</small><strong>{pct(probabilitySet.combinedProbability)}</strong><span>{probabilitySet.jointSimulationRuns.toLocaleString()} correlated sims • independent {pct(probabilitySet.independentProbability)} • {probabilitySet.learnedPairCount} learned pairs</span></div>
          <div className="legList">{probabilitySet.legs.map((x,i)=><div key={x.id}><span>{i+1}</span><div><b>{x.selection}</b><small>{x.sport} • {x.market} • sim {fmtPct(x.simProbability)}</small></div></div>)}</div>
        </div>:<p className="muted">Not enough qualified rows for this leg count under the current filters.</p>}
      </div>

      <div className="v21Card">
        <div className="v21CardHead"><div><div className="eyebrow">MULTI-SPORT</div><h3>Cross-sport probability set</h3></div><span className="miniBadge">{parlaySize} legs</span></div>
        {mixedSet?<div className="setBody">
          <div className="setScore"><small>JOINT MODEL %</small><strong>{pct(mixedSet.combinedProbability)}</strong><span>{mixedSet.jointSimulationRuns.toLocaleString()} correlated sims • {mixedSet.eventCount} events • {mixedSet.learnedPairCount} learned pairs</span></div>
          <div className="legList">{mixedSet.legs.map((x,i)=><div key={x.id}><span>{i+1}</span><div><b>{x.selection}</b><small>{x.sport} • {x.market} • sim {fmtPct(x.simProbability)}</small></div></div>)}</div>
        </div>:<p className="muted">Not enough rows to form this set.</p>}
      </div>
    </section>

    <div id="predictions"><PredictionIntelligencePanel/></div>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">PREDICTION MARKETS</div><h3>Liquid contracts fused into matching sportsbook rows</h3></div>
        <span className="miniBadge">{board.predictions.mode==='live'?(board.predictions.source||'live'):'provider not connected'}</span>
      </div>
      {predictions.length?<div className="predictionGrid">
        {predictions.map(x=><div className="predictionCard" key={x.id}>
          <small>{x.category}</small>
          <b>{x.title}</b>
          <div><span>Market</span><strong>{pct(x.yesProbability)}</strong></div>
          <div><span>Model</span><strong>{pct(x.modelProbability)}</strong></div>
          <div><span>Difference</span><strong className={x.probabilityDifference>=0?'lime':'negative'}>{x.probabilityDifference>=0?'+':''}{pct(x.probabilityDifference)}</strong></div>
          {x.volume!==undefined&&<small>Volume {Math.round(x.volume).toLocaleString()}</small>}
        </div>)}
      </div>:<div className="connectState">
        <b>Prediction-market adapter is ready.</b>
        <p>Configure PREDICTION_PROVIDER_PRIMARY_URL and its key in the production environment to populate this section. Matched contracts above the configured volume threshold are eligible for model-vs-market edge.</p>
      </div>}
    </section>

    <section className="v21Panel" id="signals">
      <div className="v21PanelHead">
        <div>
          <div className="eyebrow">V52 PRO SIGNALS • MARKET COMMAND CENTER</div>
          <h3>Entry, patience, hold, and exit decisions from model edge + venue pricing + steam + confidence</h3>
        </div>
        <div className="panelMeta">
          <span>{actionableSignals.length} enter</span>
          <span>{nowSignals.length} timing now</span>
          <span>{exitSignals.length} reduce / exit</span>
          <span>{grossArbCandidates.length} gross arb candidate(s)</span>
        </div>
      </div>
      <div className="v21Stats">
        <div><small>TOP SIGNAL</small><strong>{proSignals[0]?.signal.score??0}/100</strong><span>{proSignals[0]?proSignals[0].row.selection:'No qualified signal'}</span></div>
        <div><small>ENTER</small><strong>{actionableSignals.length}</strong><span>BUY on exchanges • BET on sportsbooks</span></div>
        <div><small>WATCH</small><strong>{watchSignals.length}</strong><span>positive edge, gate not fully cleared</span></div>
        <div><small>REDUCE / EXIT</small><strong>{exitSignals.length}</strong><span>market price above current model fair value</span></div>
      </div>
      <div className="historyGrid">
        <div className="historyBox">
          <h4>Highest conviction entries</h4>
          {actionableSignals.slice(0,8).map(({row,signal})=><div className="historyRow" key={'signal-enter-'+row.id}>
            <span>{signal.action+' '+row.selection}</span>
            <b>{signal.score}/100</b>
            <small>{row.sport+' • '+signal.venue+' • '+signal.timing+' • fair '+fmtPct(signal.fairProbability)+' • market '+fmtPct(signal.marketProbability)+' • EV '+(signal.expectedValue>=0?'+':'')+fmtPct(signal.expectedValue)}</small>
          </div>)}
          {!actionableSignals.length&&<div className="historyRow"><span>No entry clears the current gates</span><b>HOLD</b><small>The engine will not manufacture a BUY/BET signal.</small></div>}
        </div>
        <div className="historyBox">
          <h4>Price discipline + exits</h4>
          {proSignals.slice(0,8).map(({row,signal})=><div className="historyRow" key={'signal-price-'+row.id}>
            <span>{row.selection}</span>
            <b>{signal.venueType==='PREDICTION_EXCHANGE'?'≤ '+Math.round(signal.entryMaxProbability*100)+'¢':fmtOdds(signal.entryMinAmericanOdds)}</b>
            <small>{signal.venue+' entry ceiling • reduce long YES near '+Math.round(signal.reduceAtProbability*100)+'¢ • '+(signal.riskFlags.length?signal.riskFlags.slice(0,2).join(' • '):'no primary risk flag')}</small>
          </div>)}
        </div>
        <div className="historyBox">
          <h4>Timing + steam</h4>
          {proSignals.slice(0,8).map(({row,signal})=><div className="historyRow" key={'signal-timing-'+row.id}>
            <span>{row.selection}</span>
            <b>{signal.timing}</b>
            <small>{(row.lineMovement?.steam?row.lineMovement.steamStrength+' steam '+row.lineMovement.direction.toLowerCase()+' • ':'')+'edge '+(signal.edge>=0?'+':'')+fmtPct(signal.edge)+' • confidence '+fmtPct(signal.confidence)}</small>
          </div>)}
        </div>
        <div className="historyBox">
          <h4>Venue router</h4>
          {proSignals.slice(0,8).map(({row,signal})=><div className="historyRow" key={'signal-venue-'+row.id}>
            <span>{row.selection}</span>
            <b>{signal.venue}</b>
            <small>{signal.venueType.replaceAll('_',' ')+' • '+(row.predictionVenueQuotes?.length||0)+' prediction venue quote(s) matched • best EV '+(signal.expectedValue>=0?'+':'')+fmtPct(signal.expectedValue)}</small>
          </div>)}
        </div>
        <div className="historyBox">
          <h4>Cross-venue spread / arbitrage watch</h4>
          {crossVenueSignals.slice(0,8).map(({row,opportunity})=><div className="historyRow" key={'cross-venue-'+row.id}>
            <span>{row.selection}</span>
            <b>{opportunity.grossArbitrage?('GROSS ARB +'+fmtPct(opportunity.grossArbitrageMargin)):('GAP '+fmtPct(opportunity.disagreement))}</b>
            <small>{opportunity.grossArbitrage
              ?('buy YES '+Math.round((opportunity.buyYesAsk||0)*100)+'¢ '+(opportunity.buyYesVenue||'')+' • sell YES '+Math.round((opportunity.sellYesBid||0)*100)+'¢ '+(opportunity.sellYesVenue||'')+' • before fees/fill risk')
              :(opportunity.comparableVenues+' venues • price disagreement only, not risk-free arbitrage')}</small>
          </div>)}
          {!crossVenueSignals.length&&<div className="historyRow"><span>No comparable exchange quotes</span><b>—</b><small>Kalshi/Polymarket matching will populate this when both venues quote the same outcome.</small></div>}
        </div>
        <div className="historyBox">
          <h4>Model / analyst leaderboard</h4>
          {[...calibration.models].sort((a,b)=>b.decayedScore-a.decayedScore||b.sampleSize-a.sampleSize).slice(0,8).map(x=><div className="historyRow" key={'analyst-'+x.modelName+'-'+x.sport+'-'+x.marketKey}>
            <span>{x.modelName}</span>
            <b>{pct(x.decayedScore)}</b>
            <small>{x.sport} • {x.marketKey} • {x.sampleSize} settled • {x.confidenceLabel}{x.brierScore!==undefined?' • Brier '+x.brierScore.toFixed(3):''}</small>
          </div>)}
          {!calibration.models.length&&<div className="historyRow"><span>No verified model history yet</span><b>—</b><small>Analyst/model ranking only appears after settled outcomes create evidence.</small></div>}
        </div>
        <div className="historyBox">
          <h4>Sports profit leaderboard</h4>
          {board.history.sports.slice(0,8).map(x=><div className="historyRow" key={'profit-sport-'+x.key}>
            <span>{x.key}</span>
            <b>{pct(x.roi||0)}</b>
            <small>{x.hits}-{x.misses} • hit {pct(x.hitRate)} • net {money(x.net)} • {x.count} tracked slips</small>
          </div>)}
          {!board.history.sports.length&&<div className="historyRow"><span>No settled sport history yet</span><b>—</b><small>ROI rankings remain blank until real results settle.</small></div>}
        </div>
      </div>
      <div className="historyNote">Signals are model-based decision support, not guarantees. BUY/BET requires positive expected value and confidence gates; REDUCE means the current market price exceeds the model&apos;s present fair value for a long position.</div>
    </section>

    <section className="v21Grid two">
      <div className="v21Card">
        <div className="eyebrow">SIMULATION VS MARKET</div>
        <h3>Largest probability differences</h3>
        <div className="gapList">
          {topGap.map(x=><div key={x.id}>
            <div><b>{x.selection}</b><small>{x.sport} • {x.market}</small></div>
            <div className="gapNumbers"><span>{fmtPct(x.marketProb)}</span><b className={x.probabilityGap>=0?'lime':'negative'}>{x.probabilityGap>=0?'+':''}{fmtPct(x.probabilityGap)}</b><span>{fmtPct(x.simProbability)}</span></div>
          </div>)}
          {!topGap.length&&<p className="muted">No probability differences to display.</p>}
        </div>
      </div>

      <div className="v21Card">
        <div className="eyebrow">ANOMALY INTELLIGENCE</div>
        <h3>Signals that deserve review</h3>
        <div className="signalList">
          {board.anomalies.slice(0,10).map(x=><div key={x.id}>
            <span className={'signal '+x.severity.toLowerCase()}>{x.severity}</span>
            <div><b>{x.selection}</b><small>{x.sport} • score {pct(x.score)}</small><p>{x.reason}</p></div>
          </div>)}
          {!board.anomalies.length&&<p className="muted">No material anomaly signals in the current board.</p>}
        </div>
      </div>
    </section>

    <details className="operatorDrawer researchDrawer" id="research">
      <summary>
        <div>
          <span className="eyebrow">RESEARCH + RISK LAB</span>
          <strong>Validation, portfolio risk, model governance and performance</strong>
          <small>Deep evidence stays available without interrupting the primary sports decision flow.</small>
        </div>
        <span className="operatorDrawerAction">OPEN LAB</span>
      </summary>
      <div className="operatorDrawerBody">
    <section className="v21Panel">
      <div className="v21PanelHead">
        <div>
          <div className="eyebrow">V51 PREDICTION VALIDATION LAB</div>
          <h3>Out-of-sample evidence gates now control model influence</h3>
        </div>
        <div className="panelMeta">
          <span>{validationLab?.report?.sampleSize??0} settled predictions</span>
          <span>{validationLab?.report?.overall?.walkForwardFolds??0} walk-forward folds</span>
          <span>{validationLab?.report?.evidence?.promotionEligible??0} evidence-qualified</span>
        </div>
      </div>
      <div className="v21Grid three">
        <div className="v21Card">
          <div className="v21CardHead"><div><div className="eyebrow">OUT-OF-SAMPLE</div><h3>{validationLab?.report?.overall?.holdout?.sampleSize??0} holdout rows</h3></div><span className="miniBadge">Brier {validationLab?.report?.sampleSize?validationLab.report.overall.holdout.brierScore.toFixed(3):'—'}</span></div>
          <div className="historyList">
            <div className="historyRow"><span>Calibration error</span><b>{validationLab?.report?.sampleSize?fmtPct(validationLab.report.overall.holdoutCalibrationError):'—'}</b><small>lower is better</small></div>
            <div className="historyRow"><span>Market-relative Brier skill</span><b>{validationLab?.report?.sampleSize?fmtPct(validationLab.report.overall.brierSkillScore):'—'}</b><small>positive means model beats offered-price baseline</small></div>
            <div className="historyRow"><span>Average CLV</span><b>{validationLab?.report?.sampleSize?fmtPct(validationLab.report.overall.summary.avgClv):'—'}</b><small>{validationLab?.report?.diagnostics?.closingLineRows??0} rows with closing prices</small></div>
          </div>
        </div>
        <div className="v21Card">
          <div className="v21CardHead"><div><div className="eyebrow">CONTEXT + SIMULATION</div><h3>Contribution audit</h3></div><span className="miniBadge">evidence, not assumption</span></div>
          <div className="historyList">
            <div className="historyRow"><span>Context-rich Brier delta</span><b>{validationLab?.report?.sampleSize?validationLab.report.overall.contextContribution.brierDelta.toFixed(3):'—'}</b><small>negative means context-rich rows scored better; observational only</small></div>
            <div className="historyRow"><span>Simulation vs council delta</span><b>{validationLab?.report?.overall?.simulationComparison?.sampleSize?validationLab.report.overall.simulationComparison.brierDelta.toFixed(3):'—'}</b><small>{validationLab?.report?.overall?.simulationComparison?.better||'INSUFFICIENT'} • negative favors simulation</small></div>
            <div className="historyRow"><span>Tagged coverage</span><b>{validationLab?.report?.diagnostics?.contextTaggedRows??0}</b><small>{validationLab?.report?.diagnostics?.simulationTaggedRows??0} simulation-tagged</small></div>
          </div>
        </div>
        <div className="v21Card">
          <div className="v21CardHead"><div><div className="eyebrow">EVIDENCE GATES</div><h3>{validationLab?.report?.evidence?.promotionEligible??0} models eligible</h3></div><span className="miniBadge">{validationLab?.latestRun?.status||'LIVE VIEW'}</span></div>
          <div className="historyList">
            <div className="historyRow"><span>Verified / qualified</span><b>{(validationLab?.report?.evidence?.verified??0)+(validationLab?.report?.evidence?.qualified??0)}</b><small>{validationLab?.report?.evidence?.verified??0} verified • {validationLab?.report?.evidence?.qualified??0} qualified</small></div>
            <div className="historyRow"><span>Provisional / insufficient</span><b>{(validationLab?.report?.evidence?.provisional??0)+(validationLab?.report?.evidence?.insufficient??0)}</b><small>kept from full promotion</small></div>
            <div className="historyRow"><span>Failed</span><b>{validationLab?.report?.evidence?.failed??0}</b><small>runtime influence is automatically braked</small></div>
          </div>
        </div>
      </div>
    </section>
    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">V40 MODEL DIAGNOSTICS</div><h3>Fragility, concentration, disagreement, and ablation risk</h3></div>
        <span className="miniBadge">{modelDiagnostics?.sampleSize||0} markets analyzed</span>
      </div>
      <div className="v21Stats">
        <div><small>FRAGILE</small><strong>{modelDiagnostics?.summary.fragility.fragile||0}</strong><span>{modelDiagnostics?.summary.fragility.moderate||0} moderate • {modelDiagnostics?.summary.fragility.robust||0} robust</span></div>
        <div><small>AVG AGREEMENT</small><strong>{modelDiagnostics?pct(modelDiagnostics.summary.averageAgreement):'—'}</strong><span>model council consistency</span></div>
        <div><small>EFFECTIVE MODELS</small><strong>{modelDiagnostics?modelDiagnostics.summary.averageEffectiveModelCount.toFixed(1):'—'}</strong><span>after weight concentration</span></div>
        <div><small>AVG ABS EDGE</small><strong>{modelDiagnostics?pct(modelDiagnostics.summary.averageAbsoluteEdge):'—'}</strong><span>ensemble vs market baseline</span></div>
      </div>
      <div className="historyGrid">
        <div className="historyBox">
          <h4>Most fragile markets</h4>
          {(modelDiagnostics?.mostFragile||[]).slice(0,8).map(x=><div className="historyRow" key={x.market.id+x.market.market+x.market.selection}><span>{x.market.selection}</span><b>{x.explanation.diagnostics.fragility}</b><small>{x.market.sport} • ratio {x.explanation.diagnostics.fragilityRatio.toFixed(2)} • agreement {pct(x.explanation.diagnostics.councilAgreement)}</small></div>)}
          {!modelDiagnostics?.mostFragile?.length&&<div className="historyRow"><span>No diagnostics yet</span><b>—</b><small>diagnostics populate from current market rows</small></div>}
        </div>
        <div className="historyBox">
          <h4>Dominant model frequency</h4>
          {(modelDiagnostics?.summary.dominantModels||[]).slice(0,8).map(x=><div className="historyRow" key={x.name}><span>{x.name}</span><b>{x.count}</b><small>markets where this model has the largest normalized weight</small></div>)}
        </div>
      </div>
    </section>
    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">PORTFOLIO STRESS INTELLIGENCE</div><h3>Scenario stress testing + CVaR + continuous drawdown control</h3></div>
        <span className="miniBadge">{portfolio?.source?sourceLabel(portfolio.source,portfolio.source):'waiting for board'}</span>
      </div>
      <div className="v21ControlPanel">
        <div className="controlGroup">
          <label>Bankroll</label>
          <input type="number" min="1" value={bankroll} onChange={e=>setBankroll(Math.max(1,Number(e.target.value)||1))}/>
        </div>
        <div className="controlGroup">
          <label>Current drawdown %</label>
          <input type="number" min="0" max="100" step="0.5" value={drawdownPct*100} onChange={e=>setDrawdownPct(Math.max(0,Math.min(1,(Number(e.target.value)||0)/100)))}/>
        </div>
      </div>
      <div className="v21Stats">
        <div><small>ALLOCATED</small><strong>{portfolio?money(portfolio.result.totalStake):'—'}</strong><span>{portfolio?pct(portfolio.result.totalStakePct):'—'} of bankroll</span></div>
        <div><small>EXPECTED PROFIT</small><strong>{portfolio?money(portfolio.result.expectedProfit):'—'}</strong><span>model estimate • ROI {portfolio?pct(portfolio.result.expectedRoi):'—'}</span></div>
        <div><small>WORST 95% CVAR</small><strong>{portfolio?money(portfolio.result.stress.worstScenario.cvar95Loss):'—'}</strong><span>{portfolio?.result.stress.worstScenario.scenario.replaceAll('_',' ')||'stress scenario'}</span></div>
        <div><small>DRAWDOWN BREACH</small><strong>{portfolio?pct(portfolio.result.stress.worstScenario.drawdownBreachProbability):'—'}</strong><span>limit {portfolio?pct(portfolio.result.stress.drawdownLimitPct):'—'}</span></div>
      </div>
      <div className="v21Stats">
        <div><small>95% VAR</small><strong>{portfolio?money(portfolio.result.stress.worstScenario.var95Loss):'—'}</strong><span>worst scenario loss threshold</span></div>
        <div><small>LOSS PROBABILITY</small><strong>{portfolio?pct(portfolio.result.stress.worstScenario.probabilityOfLoss):'—'}</strong><span>{portfolio?.result.stress.runsPerScenario||0} sims per scenario</span></div>
        <div><small>DRAWDOWN BRAKE</small><strong>{portfolio?pct(portfolio.result.drawdownBrake):'—'}</strong><span>continuous bankroll throttle</span></div>
        <div><small>STRESS SCALE</small><strong>{portfolio?pct(portfolio.result.stressScale):'—'}</strong><span>CVaR allocation multiplier</span></div>
      </div>
      <div className="tableWrap">
        <table className="v21Table">
          <thead><tr><th>#</th><th>Sport</th><th>Selection</th><th>Stake</th><th>Stake %</th><th>Event Exposure</th><th>Sport Exposure</th><th>Correlation</th><th>Action</th></tr></thead>
          <tbody>
            {(portfolio?.result.positions||[]).slice(0,12).map((p,i)=><tr key={p.id}>
              <td className="rankCell">{i+1}</td>
              <td><span className="sportPill">{p.leg.sport}</span></td>
              <td><b>{p.leg.selection}</b><small>{p.leg.market} • sim {fmtPct(p.leg.simProbability)}</small></td>
              <td>{money(p.stake)}</td>
              <td>{pct(p.stakePct)}</td>
              <td>{pct(p.eventExposurePct)}</td>
              <td>{pct(p.sportExposurePct)}</td>
              <td>{pct(p.correlationExposurePct)}</td>
              <td><span className="grade strong">{(portfolio?.result.stressScale??1)<.85||(portfolio?.result.drawdownBrake??1)<.70||p.correlationExposurePct>=0.04?'REDUCE':'HOLD'}</span></td>
            </tr>)}
            {!portfolio?.result.positions.length&&<tr><td colSpan={9} className="emptyRow">No qualified positions under the current risk limits.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="historyGrid">
        <div className="historyBox">
          <h4>Stress scenarios</h4>
          {(portfolio?.result.stress.scenarios||[]).map(x=><div className="historyRow" key={x.scenario}><span>{x.scenario.replaceAll('_',' ')}</span><b>{money(x.cvar95Loss)}</b><small>CVaR • loss {pct(x.probabilityOfLoss)} • breach {pct(x.drawdownBreachProbability)}</small></div>)}
        </div>
        <div className="historyBox">
          <h4>Stress controls</h4>
          <div className="historyRow"><span>Drawdown throttle</span><b>{portfolio?pct(portfolio.result.drawdownBrake):'—'}</b><small>falls continuously as current drawdown rises</small></div>
          <div className="historyRow"><span>CVaR throttle</span><b>{portfolio?pct(portfolio.result.stressScale):'—'}</b><small>scales all accepted positions when tail risk exceeds limit</small></div>
          <div className="historyRow"><span>Positions</span><b>{portfolio?.result.positions.length||0}</b><small>{portfolio?.result.rejected.length||0} rejected before stress scaling</small></div>
        </div>
      </div>
      <div className="historyNote">Stress metrics are model-based estimates under defined scenarios. They reduce exposure when modeled tail risk rises, but cannot guarantee profit or bound real-world losses.</div>
    </section>
    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">V42 MODEL GOVERNANCE</div><h3>Champion/challenger selection + live drift brakes</h3></div>
        <span className="miniBadge">{modelGovernance?.latestRun?.status||'awaiting settled history'}</span>
      </div>
      <div className="v21Stats">
        <div><small>CHAMPIONS</small><strong>{modelGovernance?.summary.champions||0}</strong><span>best qualified model by sport × market</span></div>
        <div><small>CHALLENGERS</small><strong>{modelGovernance?.summary.challengers||0}</strong><span>next qualified model under evaluation</span></div>
        <div><small>DRIFTING / CRITICAL</small><strong>{(modelGovernance?.summary.drifting||0)+(modelGovernance?.summary.critical||0)}</strong><span>{modelGovernance?.summary.watch||0} additional watch states</span></div>
        <div><small>AVERAGE PSI</small><strong>{modelGovernance?modelGovernance.summary.averagePsi.toFixed(3):'—'}</strong><span>probability-distribution stability index</span></div>
      </div>
      <div className="historyGrid">
        <div className="historyBox">
          <h4>Current champions</h4>
          {(modelGovernance?.profiles||[]).filter(x=>x.role==='CHAMPION').slice(0,8).map(x=><div className="historyRow" key={x.modelName+x.sport+x.marketKey}><span>{x.modelName} • {x.sport}</span><b>{x.runtimeMultiplier.toFixed(3)}×</b><small>{x.marketKey} • {x.driftStatus} • PSI {x.psi.toFixed(3)}</small></div>)}
          {!modelGovernance?.profiles.some(x=>x.role==='CHAMPION')&&<div className="historyRow"><span>No champion snapshots yet</span><b>—</b><small>scheduled recalibration will establish roles after enough settled history exists</small></div>}
        </div>
        <div className="historyBox">
          <h4>Drift watch</h4>
          {(modelGovernance?.profiles||[]).filter(x=>x.driftStatus==='WATCH'||x.driftStatus==='DRIFTING'||x.driftStatus==='CRITICAL').sort((a,b)=>b.psi-a.psi).slice(0,8).map(x=><div className="historyRow" key={x.modelName+x.sport+x.marketKey}><span>{x.modelName} • {x.sport}</span><b>{x.driftStatus}</b><small>{x.marketKey} • PSI {x.psi.toFixed(3)} • brake {x.runtimeMultiplier.toFixed(3)}×</small></div>)}
          {!modelGovernance?.profiles.some(x=>x.driftStatus==='WATCH'||x.driftStatus==='DRIFTING'||x.driftStatus==='CRITICAL')&&<div className="historyRow"><span>No active drift warnings</span><b>CLEAR</b><small>qualified recent-vs-baseline model distributions are within configured limits</small></div>}
        </div>
      </div>
      <div className="historyNote">PSI detects shifts in the distribution of model probabilities. Performance deterioration and calibration drift independently tighten the runtime weight brake. Champion status is retained unless a challenger clears the promotion margin.</div>
    </section>
    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">MODEL CALIBRATION</div><h3>Walk-forward validation + controlled weight promotion</h3></div>
        <span className="miniBadge">{calibration.latestRun?.status||'awaiting history'}</span>
      </div>
      <div className="v21Stats">
        <div><small>PREDICTION ROWS</small><strong>{calibration.latestRun?.predictionRows||0}</strong><span>settled model forecasts</span></div>
        <div><small>GROUPS TESTED</small><strong>{calibration.latestRun?.groupsEvaluated||0}</strong><span>model × sport × market</span></div>
        <div><small>PROMOTED</small><strong>{calibration.latestRun?.groupsPromoted||0}</strong><span>{calibration.latestRun?.groupsHeld||0} held neutral</span></div>
        <div><small>ACTIVE WEIGHTS</small><strong>{calibration.weights.filter(x=>x.promoted).length}</strong><span>latest qualified snapshots</span></div>
      </div>
      <div className="historyNote">Weights change only after minimum-sample, holdout and walk-forward checks. Insufficient or unstable groups remain at a neutral 1.00 multiplier.</div>
      <div className="historyGrid">
        <div className="historyBox">
          <h4>Largest promoted adjustments</h4>
          {calibration.weights.filter(x=>x.promoted).sort((a,b)=>Math.abs(b.multiplier-1)-Math.abs(a.multiplier-1)).slice(0,8).map(x=><div className="historyRow" key={x.modelName+x.sport+x.marketKey}><span>{x.modelName} • {x.sport}</span><b>{x.multiplier.toFixed(3)}×</b><small>{x.marketKey} • n={x.sampleSize}</small></div>)}
          {!calibration.weights.some(x=>x.promoted)&&<div className="historyRow"><span>No promoted weights yet</span><b>1.000×</b><small>neutral until enough settled history exists</small></div>}
        </div>
        <div className="historyBox">
          <h4>Model calibration leaders</h4>
          {[...calibration.models].sort((a,b)=>b.decayedScore-a.decayedScore).slice(0,8).map(x=><div className="historyRow" key={x.modelName+x.sport+x.marketKey}><span>{x.modelName} • {x.sport}</span><b>{pct(x.decayedScore)}</b><small>{x.confidenceLabel} • n={x.sampleSize}{x.calibrationError!==undefined?` • cal ${pct(x.calibrationError)}`:''}</small></div>)}
          {!calibration.models.length&&<div className="historyRow"><span>Calibration history</span><b>—</b><small>settled model predictions will populate this automatically</small></div>}
        </div>
      </div>
    </section>
    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">BANKROLL + PERFORMANCE LEDGER</div><h3>Persistent settled-wager analytics</h3></div>
        <span className="miniBadge">{board.history.settledCount||0} settled • {board.history.pendingCount||0} open</span>
      </div>
      <div className="v21Stats">
        <div><small>CUMULATIVE STAKE</small><strong>{money(board.history.overall.staked)}</strong><span>{board.history.sampleSize} total recorded slips</span></div>
        <div><small>CUMULATIVE RETURN</small><strong>{money(board.history.overall.returned)}</strong><span>settled wagers only</span></div>
        <div><small>NET P/L</small><strong>{money(board.history.overall.net)}</strong><span>ROI {pct(board.history.overall.roi||0)}</span></div>
        <div><small>MODEL WIN / LOSS AVG</small><strong>{board.history.avgModelWinner!==undefined?pct(board.history.avgModelWinner):'—'}</strong><span>losers {board.history.avgModelLoser!==undefined?pct(board.history.avgModelLoser):'—'}</span></div>
      </div>
      <div className="historyNote">Open wagers are excluded from settled ROI and hit-rate calculations. Unknown hidden leg outcomes stay unknown rather than being guessed.</div>
      <div className="historyGrid">
        <div className="historyBox">
          <h4>Parlay performance by sport</h4>
          {board.history.sports.map(x=><div className="historyRow" key={x.key}><span>{x.key}</span><b>{pct(x.hitRate)}</b><small>{x.hits}-{x.misses} • ROI {pct(x.roi||0)} • net {money(x.net)}</small></div>)}
        </div>
        <div className="historyBox">
          <h4>By parlay size</h4>
          {board.history.legCounts.map(x=><div className="historyRow" key={x.key}><span>{x.key} legs</span><b>{pct(x.hitRate)}</b><small>{x.hits}-{x.misses} • ROI {pct(x.roi||0)} • net {money(x.net)}</small></div>)}
        </div>
        <div className="historyBox">
          <h4>Individual leg hit rate by sport</h4>
          {(board.history.legSports||[]).map(x=><div className="historyRow" key={x.key}><span>{x.key}</span><b>{pct(x.hitRate)}</b><small>{x.hits}-{x.misses} known legs</small></div>)}
        </div>
        <div className="historyBox">
          <h4>Market-type hit rate</h4>
          {board.history.markets.map(x=><div className="historyRow" key={x.key}><span>{x.key}</span><b>{pct(x.hitRate)}</b><small>{x.hits}-{x.misses} known legs</small></div>)}
        </div>
        <div className="historyBox">
          <h4>Model probability bands</h4>
          {(board.history.probabilityBands||[]).map(x=><div className="historyRow" key={x.key}><span>{x.key}</span><b>{pct(x.hitRate)}</b><small>{x.hits}-{x.misses} known outcomes</small></div>)}
        </div>
        <div className="historyBox">
          <h4>Current leaders</h4>
          <div className="historyRow"><span>Best sport</span><b>{board.history.bestSport||'—'}</b><small>minimum two settled decisions</small></div>
          <div className="historyRow"><span>Best parlay size</span><b>{board.history.bestParlaySize?board.history.bestParlaySize+' legs':'—'}</b><small>ranked by ROI, then hit rate</small></div>
        </div>
      </div>
    </section>
    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">V41 RELEASE CERTIFICATION</div><h3>Data, automation, security, and deployment gate</h3></div>
        <span className="miniBadge">{releaseCertification?.latest?(releaseCertification.latest.certified?'CERTIFIED':'BLOCKED'):'AWAITING DEPLOYMENT'}</span>
      </div>
      <div className="v21Stats">
        <div><small>DATA CONTRACT</small><strong>{dataQuality?.audit?.grade||'—'}</strong><span>{dataQuality?.audit?`${dataQuality.audit.validRows}/${dataQuality.audit.rowCount} valid • ${dataQuality.audit.invalidRows} invalid`:'audit loading'}</span></div>
        <div><small>AUTOMATION HEALTH</small><strong>{automationHealth?(automationHealth.healthy?'HEALTHY':automationHealth.failedCount?'FAILED':automationHealth.staleCount?'STALE':'PENDING'):'—'}</strong><span>{automationHealth?`${automationHealth.healthyCount} healthy • ${automationHealth.pendingCount} pending`:'health loading'}</span></div>
        <div><small>LATEST CERTIFICATE</small><strong>{releaseCertification?.latest?.releaseVersion||'—'}</strong><span>{releaseCertification?.latest?dateLabel(releaseCertification.latest.createdAt):'created after a certified deployment'}</span></div>
        <div><small>CERTIFICATION RECORDS</small><strong>{dbStats.counts?.production_certifications||0}</strong><span>{dbStats.counts?.automation_runs||0} automation runs recorded</span></div>
      </div>
      <div className="historyGrid">
        <div className="historyBox">
          <h4>Certification blockers</h4>
          {(releaseCertification?.latest?.blockers||[]).slice(0,8).map((x,i)=><div className="historyRow" key={i}><span>{x}</span><b>BLOCK</b><small>must clear before strict production certification</small></div>)}
          {!releaseCertification?.latest?.blockers?.length&&<div className="historyRow"><span>{releaseCertification?.latest?.certified?'No recorded blockers':'No final production certificate yet'}</span><b>{releaseCertification?.latest?.certified?'CLEAR':'—'}</b><small>{releaseCertification?.latest?.certified?'latest release passed the final gate':'deployment credentials and live certification are required'}</small></div>}
        </div>
        <div className="historyBox">
          <h4>Scheduled automation</h4>
          {(automationHealth?.jobs||[]).map(x=><div className="historyRow" key={x.jobName}><span>{x.jobName}</span><b>{x.state}</b><small>{x.lastRun?dateLabel(x.lastRun):'no durable run yet'}</small></div>)}
          {!automationHealth?.jobs?.length&&<div className="historyRow"><span>Automation health</span><b>—</b><small>loads from durable scheduler records</small></div>}
        </div>
      </div>
      <div className="historyNote">Final certification is an operational launch gate. It confirms configured systems agree at deployment time; it does not guarantee model accuracy, winnings, or future provider availability.</div>
    </section>
      </div>
    </details>

    <details className="operatorDrawer" id="operator">
      <summary>
        <div>
          <span className="eyebrow">ADVANCED OPERATOR CONSOLE</span>
          <strong>Models, reliability, deployment and deep context</strong>
          <small>Open only when you need engineering diagnostics or model internals.</small>
        </div>
        <span className="operatorDrawerAction">OPEN CONSOLE</span>
      </summary>
      <div className="operatorDrawerBody">
        <SloGovernorPanel/>
        <DeploymentGuardPanel/>
        <VercelGovernorPanel/>
        <ProductionTopologyWatchdogPanel/>
        <ReliabilitySupervisorPanel/>
        <UnifiedIntelligencePanel/>
        <CrossSportOptimizerPanel/>
        <MarketMovementLearningPanel/>
        <VenueConditionsPanel/>
        <ScheduleFatiguePanel/>
        <StartingLineupPanel/>
        <LineupRedistributionPanel/>
        <OpponentMatchupPanel/>
        <PlayerCalibrationPanel/>
        <PlayerFeatureFramesPanel/>
        <ShadowRecoveryPanel/>
        <ChampionDriftPanel/>
        <FirstChampionTournamentPanel/>
        <MlDeploymentAutomationPanel/>
        <MlServiceActivationPanel/>
        <ExternalMlTournamentPanel/>
        <TrainedSportModelsPanel/>
        <ExpertModelSuitePanel/>
        <OperatorCommandCenter/>
      </div>
    </details>

    <section className="v21FooterGrid">
      <div><small>ATHLETES</small><b>{dbStats.counts?.athletes||0}</b></div>
      <div><small>PLAYER GAME STATS</small><b>{dbStats.counts?.player_game_stats||0}</b></div>
      <div><small>MARKET SNAPSHOTS</small><b>{dbStats.counts?.market_snapshots||0}</b></div>
      <div><small>CONSENSUS SNAPSHOTS</small><b>{dbStats.counts?.market_consensus_snapshots||0}</b></div>
      <div><small>MODEL RUNS</small><b>{dbStats.counts?.model_runs||0}</b></div>
      <div><small>SETTLED RESULTS</small><b>{dbStats.counts?.bet_results||0}</b></div>
      <div><small>AUTOMATION RUNS</small><b>{dbStats.counts?.automation_runs||0}</b></div>
      <div><small>RELEASE CERTS</small><b>{dbStats.counts?.production_certifications||0}</b></div>
      <div><small>GOVERNANCE RUNS</small><b>{dbStats.counts?.model_governance_runs||0}</b></div>
      <div><small>GOVERNANCE SNAPSHOTS</small><b>{dbStats.counts?.model_governance_snapshots||0}</b></div>
    </section>
    {selectedMarket&&<MarketDrilldown marketId={selectedMarket.id} marketKey={selectedMarket.market} selection={selectedMarket.selection} onClose={()=>setSelectedMarket(null)}/>}
  </main>;
}
