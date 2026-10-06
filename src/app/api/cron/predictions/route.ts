import {recordAutomationRun} from '@/lib/automationHealth';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {fetchKalshiTrades,fetchPolymarketTrades,enrichKalshiTradeTitles,summarizeFlow,marketMovers,crossVenueGaps} from '@/lib/predictionFlow';
import {buildTraderSignals,fetchPolymarketLeaderboard} from '@/lib/predictionTraderIntelligence';
import {buildPredictionDecisionSignals} from '@/lib/predictionDecisionSignals';
import {
 persistPredictionContracts,persistPredictionTrades,persistPredictionDecisionSignals,upsertPublicTraderProfiles,predictionWarehouseStats
} from '@/lib/predictionPersistence';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`){
  return Response.json({ok:false,error:'unauthorized'},{status:401});
 }

 const started=Date.now();
 try{
  const platform=String(process.env.DEPLOYMENT_PLATFORM||'unknown').toLowerCase();
  const cloudflareBounded=platform==='cloudflare';
  const contractLimit=Math.max(100,Math.min(cloudflareBounded?500:10000,Number(process.env.PREDICTION_MARKET_MAX_CONTRACTS||(cloudflareBounded?500:4000))));
  const tradeLimit=Math.max(100,Math.min(cloudflareBounded?100:1000,Number(process.env.PREDICTION_CRON_TRADE_LIMIT||(cloudflareBounded?100:750))));
  const leaderboardLimit=Math.max(10,Math.min(cloudflareBounded?25:150,Number(process.env.PREDICTION_CRON_LEADERBOARD_LIMIT||(cloudflareBounded?25:150))));
  const analysisLimit=Math.max(20,Math.min(cloudflareBounded?40:100,Number(process.env.PREDICTION_CRON_ANALYSIS_LIMIT||(cloudflareBounded?40:80))));
  const signalLimit=Math.max(20,Math.min(cloudflareBounded?50:200,Number(process.env.PREDICTION_CRON_SIGNAL_LIMIT||(cloudflareBounded?50:100))));
  const executionProfile={platform,cloudflareBounded,contractLimit,tradeLimit,leaderboardLimit,analysisLimit,signalLimit};
  const warnings:string[]=[];
  const [predictions,kalshi,polymarket,leaderboard]=await Promise.all([
   fetchPredictionMarkets({maxContracts:contractLimit}).catch(error=>({
    mode:'failed' as const,source:null,contracts:[],attempts:[],sources:[],warnings:[],
    error:error instanceof Error?error.message:'prediction markets unavailable'
   })),
   fetchKalshiTrades(tradeLimit).catch(error=>({
    ok:false,trades:[],error:error instanceof Error?error.message:'Kalshi trades unavailable'
   })),
   fetchPolymarketTrades(tradeLimit).catch(error=>({
    ok:false,trades:[],error:error instanceof Error?error.message:'Polymarket trades unavailable'
   })),
   fetchPolymarketLeaderboard('week',leaderboardLimit).catch(error=>({
    ok:false,rows:[],error:error instanceof Error?error.message:'Polymarket leaderboard unavailable',cached:false as const
   }))
  ]);
  if(predictions.error)warnings.push('Prediction contracts: '+predictions.error);
  if(!kalshi.ok&&kalshi.error)warnings.push('Kalshi trade tape: '+kalshi.error);
  if(!polymarket.ok&&polymarket.error)warnings.push('Polymarket trade tape: '+polymarket.error);
  if(!leaderboard.ok&&leaderboard.error)warnings.push('Polymarket leaderboard: '+leaderboard.error);

  const trades=enrichKalshiTradeTitles(
   [...kalshi.trades,...polymarket.trades]
    .sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()),
   predictions.contracts
  );

  const flow4h=summarizeFlow(trades,'4H');
  const movers=marketMovers(trades,'4H',analysisLimit);
  const gaps=crossVenueGaps(predictions.contracts,analysisLimit);
  const traderSignals=buildTraderSignals(trades,leaderboard.rows,analysisLimit);
  const decisionSignals=buildPredictionDecisionSignals(predictions.contracts,gaps,flow4h,movers,traderSignals,signalLimit);

  const [marketWrite,tradeWrite,signalWrite,leaderWrite]=await Promise.all([
   persistPredictionContracts(predictions.contracts,true).catch(error=>{
    warnings.push('Prediction market persistence: '+(error instanceof Error?error.message:'failed'));
    return {stateWritten:0,snapshotsWritten:0,mode:'memory' as const};
   }),
   persistPredictionTrades(trades).catch(error=>{
    warnings.push('Prediction trade persistence: '+(error instanceof Error?error.message:'failed'));
    return {written:0,tradersUpdated:0,mode:'memory' as const};
   }),
   persistPredictionDecisionSignals(decisionSignals).catch(error=>{
    warnings.push('Prediction signal persistence: '+(error instanceof Error?error.message:'failed'));
    return {written:0,mode:'memory' as const};
   }),
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
   ).catch(error=>{
    warnings.push('Prediction leaderboard persistence: '+(error instanceof Error?error.message:'failed'));
    return {written:0,mode:'memory' as const};
   })
  ]);

  const warehouse=await predictionWarehouseStats().catch(error=>{
   warnings.push('Prediction warehouse stats: '+(error instanceof Error?error.message:'failed'));
   return {configured:false,markets:0,snapshots:0,trades:0,traders:0,signals:0,buySignals:0,lastMarketUpdate:null,lastTrade:null,lastSignal:null};
  });
  const degraded=warnings.length>0;
  await recordAutomationRun('prediction-intelligence','success',started,{degraded,
   contracts:predictions.contracts.length,
   tradesFetched:trades.length,
   marketsPersisted:marketWrite.stateWritten,
   snapshotsWritten:marketWrite.snapshotsWritten,
   tradesWritten:tradeWrite.written,
   tradersUpdated:tradeWrite.tradersUpdated,
   leaderboardProfiles:leaderWrite.written,
   decisionSignals:decisionSignals.length,
   actionableSignals:decisionSignals.filter(x=>x.action==='BUY_YES'||x.action==='BUY_NO').length,
   signalsWritten:signalWrite.written,
   warehouse,
   executionProfile
  });

  return Response.json({
   ok:true,
   degraded,
   ranAt:new Date().toISOString(),
   scope:'ALL_PREDICTION_MARKETS',
   executionProfile,
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
    signals:signalWrite
   },
   decisionSignals:{
    generated:decisionSignals.length,
    actionable:decisionSignals.filter(x=>x.action==='BUY_YES'||x.action==='BUY_NO').length,
    gradeA:decisionSignals.filter(x=>x.evidenceGrade==='A').length
   },
   warehouse,
   warnings:[...new Set([...(predictions.warnings||[]),...warnings])]
  },{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=error instanceof Error?error.message:'prediction intelligence collection failed';
  await recordAutomationRun('prediction-intelligence','failed',started,{},message);
  return Response.json({ok:false,error:message},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
