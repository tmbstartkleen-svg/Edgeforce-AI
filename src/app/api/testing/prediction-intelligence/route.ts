import {marketMovers,type PredictionTrade,type CrossVenueGap} from '@/lib/predictionFlow';
import {buildPredictionDecisionSignals} from '@/lib/predictionDecisionSignals';
import {buildTraderSignals,type PolymarketLeaderboardRow} from '@/lib/predictionTraderIntelligence';
import {classifyPredictionContract} from '@/lib/predictionCategories';

export const dynamic='force-dynamic';

export async function GET(){
 const now=Date.now();
 const trader='0x1111111111111111111111111111111111111111';
 const trades:PredictionTrade[]=[
  {
   id:'t1',venue:'Polymarket',marketId:'fed-cut',title:'Will the Fed cut rates this month?',
   direction:'YES',price:.40,size:250,notional:100,signedYesFlow:100,
   timestamp:new Date(now-90*60*1000).toISOString(),traderId:trader
  },
  {
   id:'t2',venue:'Polymarket',marketId:'fed-cut',title:'Will the Fed cut rates this month?',
   direction:'YES',price:.55,size:2000,notional:1100,signedYesFlow:1100,
   timestamp:new Date(now-10*60*1000).toISOString(),traderId:trader
  }
 ];
 const leaderboard:PolymarketLeaderboardRow[]=[
  {rank:5,traderId:trader,name:'Test Sharp',pnl:50000,volume:250000,verified:true}
 ];

 const movers=marketMovers(trades,'4H',10,now);
 const traders=buildTraderSignals(trades,leaderboard,10);
 const category=classifyPredictionContract({
  id:'fed-cut',title:'Will the Federal Reserve cut interest rates this month?',category:'Markets',
  yesProbability:.55,noProbability:.45,modelProbability:.55,probabilityDifference:0,source:'Polymarket'
 });

 const mover=movers[0];
 const signal=traders[0];

 const kalshiContract={
  id:'fed-kalshi',title:'Will the Federal Reserve cut interest rates this month?',category:'Economics',
  yesProbability:.42,noProbability:.58,modelProbability:.42,probabilityDifference:0,
  bidProbability:.41,askProbability:.43,volume:50000,liquidity:25000,source:'Kalshi'
 };
 const polyContract={
  id:'fed-poly',title:'Will the Federal Reserve cut interest rates this month?',category:'Economics',
  yesProbability:.60,noProbability:.40,modelProbability:.60,probabilityDifference:0,
  bidProbability:.59,askProbability:.61,volume:500000,liquidity:250000,source:'Polymarket'
 };
 const gap:CrossVenueGap={
  kalshi:kalshiContract,
  polymarket:polyContract,
  similarity:.95,
  probabilityGap:-.18,
  absoluteGap:.18,
  lowerVenue:'Kalshi',
  higherVenue:'Polymarket',
  lowerProbability:.42,
  higherProbability:.60,
  matchQuality:'STRONG'
 };
 const decisions=buildPredictionDecisionSignals(
  [kalshiContract,polyContract],
  [gap],
  [],
  [],
  [],
  10
 );
 const decision=decisions[0];
 const ok=
  mover?.probabilityChange>.14&&mover?.probabilityChange<.16&&
  signal?.rank===5&&signal?.pnl===50000&&signal?.smartScore>.5&&
  category==='ECONOMICS'&&
  decision?.action==='BUY_YES'&&decision?.venue==='Kalshi'&&decision?.edge>.05;

 return Response.json({
  ok,
  mover,
  signal,
  decision,
  category
 },{status:ok?200:500,headers:{'Cache-Control':'no-store'}});
}
