import {normalizeExchangeTrades,type ExchangeTradeBatch} from './exchangeTradeNormalization';
import {replayLimitTouches,type LimitTouchReplayResult} from './marketLimitTouchReplay';
import {validateExchangeCoverage,type ExchangeCoverageEvidence} from './exchangeCoverageEvidence';

/** Ensures replay trades belong to the exact contract selected by the forecast. */
export type ExchangeLimitReplayRequest={
 exchange:'kalshi'|'polymarket';
 marketId:string;
 gameId:string;
 forecastCreatedAt:string;
 gameStartedAt:string;
 gameEndedAt:string;
 limitPrice:number;
 batch:ExchangeTradeBatch;
 coverage:ExchangeCoverageEvidence;
};
export type ExchangeLimitReplayResult={
 status:'invalid'|'incomplete'|'ok';
 replay:LimitTouchReplayResult|null;
 exchange:string;
 marketId:string;
 warning:string;
};
export function replayExchangeLimit(request:ExchangeLimitReplayRequest):ExchangeLimitReplayResult{
 const warning='Read-only historical trade replay. Market ID equality is required; settlement-rule equivalence across exchanges is not assumed. Touch does not establish fill.';
 const base=(status:ExchangeLimitReplayResult['status']):ExchangeLimitReplayResult=>({
  status,replay:null,exchange:request.exchange,marketId:request.marketId,warning
 });
 if(!request.marketId||request.exchange!==request.batch.exchange||
  request.marketId!==request.batch.marketId)return base('invalid');
 const coverage=validateExchangeCoverage(request.batch,request.coverage);
 if(coverage.status==='invalid')return base('invalid');
 if(coverage.status!=='covered')return base('incomplete');
 const normalized=normalizeExchangeTrades(request.batch);
 if(normalized.status!=='ok')return base(normalized.status);
 const replay=replayLimitTouches({gameId:request.gameId,forecastCreatedAt:request.forecastCreatedAt,
  gameStartedAt:request.gameStartedAt,gameEndedAt:request.gameEndedAt,
  historyComplete:true,limitPrice:request.limitPrice,prints:normalized.prints});
 if(replay.status==='invalid')return base('invalid');
 if(replay.status==='insufficient_evidence')return base('incomplete');
 return {status:'ok',replay,exchange:request.exchange,marketId:request.marketId,warning};
}
