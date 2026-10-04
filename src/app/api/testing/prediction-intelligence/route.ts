import {marketMovers,type PredictionTrade} from '@/lib/predictionFlow';
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
 const ok=
  mover?.probabilityChange>.14&&mover?.probabilityChange<.16&&
  signal?.rank===5&&signal?.pnl===50000&&signal?.smartScore>.5&&
  category==='ECONOMICS';

 return Response.json({
  ok,
  mover,
  signal,
  category
 },{status:ok?200:500,headers:{'Cache-Control':'no-store'}});
}
