import {planFromSimulatedMarketPaths,type MarketPathPlanInputs} from './simulatedMarketPathEntries';

/** Read-only pregame comparison for two independent exchange books. */
export type ExchangeEntryComparison={
 gameId:string;
 gameStart:string;
 markets:ReturnType<typeof planFromSimulatedMarketPaths>[];
 status:'ready_for_research'|'insufficient_evidence';
 warning:string;
};
export function comparePregameExchangeEntries(
 kalshi:MarketPathPlanInputs,
 polymarket:MarketPathPlanInputs
):ExchangeEntryComparison{
 const a=planFromSimulatedMarketPaths(kalshi);
 const b=planFromSimulatedMarketPaths(polymarket);
 const validIdentity=kalshi.gameId===polymarket.gameId&&kalshi.gameStart===polymarket.gameStart&&
 kalshi.platform==='kalshi'&&polymarket.platform==='polymarket'&&
 kalshi.marketId!==polymarket.marketId;
 const ready=validIdentity&&a.status==='ok'&&b.status==='ok';
 return {gameId:kalshi.gameId,gameStart:kalshi.gameStart,
  markets:[a,b],status:ready?'ready_for_research':'insufficient_evidence',
  warning:'Research comparison only. Different exchanges can settle different contracts; verify market equivalence, fees, liquidity and live book data before interpreting price differences.'};
}
