import {replayLimitTouches,type MarketTradePrint} from './marketLimitTouchReplay';
import type {EntryReplayObservation} from './marketEntryReplayCalibration';

/**
 * Builds an inspectable pregame forecast ledger from historical market trades.
 * Never infers order fills from prints or marks missing trade history as a miss.
 */
export type ForecastLedgerRow={
 forecastId:string;
 gameId:string;
 forecastCreatedAt:string;
 gameStartedAt:string;
 gameEndedAt:string;
 historyComplete:boolean;
 limitPrice:number;
 predictedTouchProbability:number;
 prints:MarketTradePrint[];
};
export type ForecastLedgerResult={
 observations:EntryReplayObservation[];
 excluded:{forecastId:string;reason:string}[];
 warning:string;
};
export function buildMarketEntryForecastLedger(rows:ForecastLedgerRow[]):ForecastLedgerResult{
 const observations:EntryReplayObservation[]=[];
 const excluded:{forecastId:string;reason:string}[]=[];
 const seen=new Set<string>();
 for(const row of rows){
  if(!row.forecastId||seen.has(row.forecastId)||!Number.isFinite(row.predictedTouchProbability)||
    row.predictedTouchProbability<0||row.predictedTouchProbability>1){
   excluded.push({forecastId:row.forecastId,reason:'invalid_or_duplicate_forecast'});continue;
  }
  seen.add(row.forecastId);
  const replay=replayLimitTouches(row);
  if(replay.status!=='ok'){
   excluded.push({forecastId:row.forecastId,reason:replay.status});continue;
  }
  observations.push({gameId:row.gameId,forecastCreatedAt:row.forecastCreatedAt,
   gameStartedAt:row.gameStartedAt,predictedTouchProbability:row.predictedTouchProbability,
   observedTouch:replay.observedTouch===true,observedFill:null});
 }
 return {observations,excluded,
  warning:'Trade prints provide historical touch labels only; order fills remain unknown until separately verified execution records are available.'};
}
