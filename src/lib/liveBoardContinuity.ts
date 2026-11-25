import {analyzeHistory} from './historyAnalytics';
import {mergeObservedOddsSnapshots,type ObservedOddsSnapshot} from './observedOdds';
import {evaluatePulseEvidence} from './pulseEvidence';
import type {HistoricalBet} from './betHistory';
import type {RiskProfile} from './types';
import type {fetchLiveScoreMesh} from './liveScoreMesh';
import type {fetchFanDuelOddsPulse} from './providers/fanLineWire';
import type {fetchPredictionMarkets} from './predictionMarkets';
import type {PriceReview} from './providers/priceReview';
import type {OddsAttempt} from './providers/odds';

export const LIVE_BOARD_SCHEMA='edgeforce-live-board-v199';
export type LiveBoardCoreStatus={
 ok:boolean;
 code:'READY'|'NO_ELIGIBLE_MARKETS'|'CORE_TIMEOUT'|'CORE_FAILED';
 error?:string;
};

export function unavailableLiveBoard(input:{
 view:'today'|'week';limit:30|50;risk:RiskProfile;
 coreStatus:LiveBoardCoreStatus;
 liveScores:Awaited<ReturnType<typeof fetchLiveScoreMesh>>;
 fanduelPulse:Awaited<ReturnType<typeof fetchFanDuelOddsPulse>>;
 predictions:Awaited<ReturnType<typeof fetchPredictionMarkets>>;
 referenceOdds?:ObservedOddsSnapshot;
 providerAttempts?:OddsAttempt[];
 priceReview?:PriceReview;
 ledgerHistory:HistoricalBet[];
 now?:number;
}){
 const now=input.now??Date.now();
 const observedOdds=mergeObservedOddsSnapshots([input.referenceOdds,input.liveScores.observedOdds],now);
 const observationOnly=observedOdds.referenceCount>0||evaluatePulseEvidence(input.fanduelPulse,now).usable||Boolean(input.priceReview?.corroboratedMarkets);
 return {
  schema:LIVE_BOARD_SCHEMA,ok:false,degraded:true,
  coreStatus:{...input.coreStatus,ok:false},
  error:input.coreStatus.code,
  message:input.coreStatus.error,
  generatedAt:new Date(now).toISOString(),uiRefreshMs:1000,sourceRefreshMs:10000,nextLiveRefreshMs:0,
  view:input.view,limit:input.limit,risk:input.risk,
  source:'unavailable',providerMode:'failed',providerDegraded:true,
  providerAttempts:input.providerAttempts||[],providerPanel:[],providerQuality:null,priceReview:input.priceReview??null,
  contextChanges:[],resimulationTriggered:false,resimulatedMarketIds:[],resimulationResults:[],
  warnings:[input.coreStatus.error||'The model-data pipeline is unavailable.'],
  liveScores:input.liveScores,fanduelPulse:input.fanduelPulse,observedOdds,observationOnly,
  topBoardQualification:{
   requested:input.limit,candidates:0,qualified:0,shown:0,withheld:0,forced:false,
   fallbackMode:null,fallbackReason:null,minimumSimProbability:.52,minimumDynamicConfidence:.50,
   allowedGrades:['ELITE','STRONG'],downgradeCounts:{}
  },
  rows:[],sports:[],predictions:input.predictions,
  predictionCoverage:{minimumVolume:0,matched:0,illiquid:0,unknownLiquidity:0,unmatched:0},
  steamCount:0,steamAlerts:[],history:analyzeHistory(input.ledgerHistory),historicalBets:input.ledgerHistory,anomalies:[]
 };
}
