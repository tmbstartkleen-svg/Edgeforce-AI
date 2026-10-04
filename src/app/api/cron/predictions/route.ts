import {recordAutomationRun} from '@/lib/automationHealth';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {fetchKalshiTrades,fetchPolymarketTrades,enrichKalshiTradeTitles} from '@/lib/predictionFlow';
import {fetchPolymarketLeaderboard} from '@/lib/predictionTraderIntelligence';
import {
 persistPredictionContracts,persistPredictionTrades,upsertPublicTraderProfiles,predictionWarehouseStats
} from '@/lib/predictionPersistence';
import {persistPredictionPositionMarks} from '@/lib/predictionPositions';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`){
  return Response.json({ok:false,error:'unauthorized'},{status:401});
 }

 const started=Date.now();
 try{
  const tradeLimit=Math.max(100,Math.min(1000,Number(process.env.PREDICTION_CRON_TRADE_LIMIT||750)));
  const [predictions,kalshi,polymarket,leaderboard]=await Promise.all([
   fetchPredictionMarkets(),
   fetchKalshiTrades(tradeLimit),
   fetchPolymarketTrades(tradeLimit),
   fetchPolymarketLeaderboard('week',150)
  ]);

  const trades=enrichKalshiTradeTitles(
   [...kalshi.trades,...polymarket.trades]
    .sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()),
   predictions.contracts
  );

  const [marketWrite,tradeWrite,leaderWrite,positionMarks]=await Promise.all([
   persistPredictionContracts(predictions.contracts,true),
   persistPredictionTrades(trades),
   upsertPublicTraderProfiles(
    leaderboard.rows.map(row=>({
     venue:'Polymarket',
     traderId:row.traderId,
     rank:row.rank,
     pnl:row.pnl,
     volume:row.volume,
     name:row.name,
     verified:row.verified,
     raw:row as unknown as Record<string,unknown>
    }))
   ),
   persistPredictionPositionMarks(predictions.contracts)
  ]);

  const warehouse=await predictionWarehouseStats();
  await recordAutomationRun('prediction-intelligence','success',started,{
   contracts:predictions.contracts.length,
   tradesFetched:trades.length,
   marketsPersisted:marketWrite.stateWritten,
   snapshotsWritten:marketWrite.snapshotsWritten,
   tradesWritten:tradeWrite.written,
   tradersUpdated:tradeWrite.tradersUpdated,
   leaderboardProfiles:leaderWrite.written,
   positionMarks,
   warehouse
  });

  return Response.json({
   ok:true,
   ranAt:new Date().toISOString(),
   scope:'ALL_PREDICTION_MARKETS',
   sources:predictions.sources||[],
   fetched:{
    contracts:predictions.contracts.length,
    kalshiTrades:kalshi.trades.length,
    polymarketTrades:polymarket.trades.length,
    leaderboard:leaderboard.rows.length
   },
   persisted:{
    markets:marketWrite,
    trades:tradeWrite,
    leaderboard:leaderWrite,
    positionMarks
   },
   warehouse,
   warnings:[
    ...(predictions.warnings||[]),
    ...(!kalshi.ok&&kalshi.error?['Kalshi trade tape: '+kalshi.error]:[]),
    ...(!polymarket.ok&&polymarket.error?['Polymarket trade tape: '+polymarket.error]:[]),
    ...(!leaderboard.ok&&leaderboard.error?['Polymarket leaderboard: '+leaderboard.error]:[])
   ]
  },{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=error instanceof Error?error.message:'prediction intelligence collection failed';
  await recordAutomationRun('prediction-intelligence','failed',started,{},message);
  return Response.json({ok:false,error:message},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
