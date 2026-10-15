import {joinAuthorizedSoccerMarkets} from './soccer-market-identity-join.mjs';
import {isSoccerBoardRow} from './soccer-live-board-gate.mjs';
/**
 * Controlled join adapter for live-board soccer rows. Do not infer an event ID from team names.
 * Empty evidence arrays are the safe default until live authorized providers are connected.
 */
export function resolveSoccerBoardMarkets(rows,{scores=[],quotes=[],now=Date.now()}={}){
 const soccer=rows.filter(isSoccerBoardRow);
 const identities=soccer.map(row=>({...row,leagueId:row.canonicalLeagueId||null,eventId:row.sourceEventId||null}));
 const join=joinAuthorizedSoccerMarkets({markets:identities,scores,quotes,now});
 const approved=new Set(join.results.filter(x=>x.eligible).map(x=>x.marketId));
 const eligible=rows.filter(row=>!isSoccerBoardRow(row)||approved.has(row.id));
 return {eligible,withheldSoccerCount:soccer.length-join.approved,approvedSoccerCount:join.approved,
  evidenceMode:'EXPLICIT_APPROVED_FIXTURE_AND_LICENSED_MARKET_ONLY',joins:join.results,
  fullDraftKingsInventoryCertified:false};
}
