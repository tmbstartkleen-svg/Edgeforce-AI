import type {ExchangeTradeBatch} from './exchangeTradeNormalization';

/**
 * Validates the declared coverage interval before using historical trades to
 * label a completed game. Provider metadata is evidence supplied by caller,
 * not independent proof that an exchange returned every trade.
 */
export type ExchangeCoverageEvidence={
 exchange:'kalshi'|'polymarket';
 marketId:string;
 requestedStart:string;
 requestedEnd:string;
 providerCoverageStart:string;
 providerCoverageEnd:string;
 providerConfirmedComplete:boolean;
};
export type ExchangeCoverageResult={
 status:'invalid'|'insufficient_evidence'|'covered';
 warning:string;
};
export function validateExchangeCoverage(batch:ExchangeTradeBatch,evidence:ExchangeCoverageEvidence):ExchangeCoverageResult{
 const warning='Provider coverage is caller-declared and must be independently verified against exchange API metadata. Historical trade prices do not establish actual fills.';
 const result=(status:ExchangeCoverageResult['status']):ExchangeCoverageResult=>({status,warning});
 const times=[evidence.requestedStart,evidence.requestedEnd,evidence.providerCoverageStart,evidence.providerCoverageEnd].map(Date.parse);
 if(batch.exchange!==evidence.exchange||batch.marketId!==evidence.marketId||
  times.some(t=>!Number.isFinite(t))||times[0]>=times[1]||times[2]>times[3])return result('invalid');
 if(!batch.paginationComplete||!batch.windowComplete||evidence.providerConfirmedComplete!==true||
  times[2]>times[0]||times[3]<times[1])return result('insufficient_evidence');
 return result('covered');
}
