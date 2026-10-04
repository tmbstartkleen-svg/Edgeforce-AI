import {fetchPredictionMarkets,type PredictionContract} from '@/lib/predictionMarkets';
import {
 convictionTrades,crossVenueGaps,enrichKalshiTradeTitles,
 fetchKalshiTrades,fetchPolymarketTrades,marketMovers,summarizeFlow,type FlowWindow
} from '@/lib/predictionFlow';
import {classifyPredictionContract,type PredictionCategory} from '@/lib/predictionCategories';
import {buildTraderSignals,fetchPolymarketLeaderboard} from '@/lib/predictionTraderIntelligence';
import {buildPredictionDecisionSignals} from '@/lib/predictionDecisionSignals';
import {predictionWarehouseStats} from '@/lib/predictionPersistence';

export const dynamic='force-dynamic';

function contractDepth(contract:PredictionContract){
 return (contract.volume??0)+(contract.liquidity??0);
}

function marketRow(contract:PredictionContract){
 const bid=contract.bidProbability;
 const ask=contract.askProbability;
 const spread=bid!==undefined&&ask!==undefined?Math.max(0,ask-bid):undefined;
 return {
  id:contract.id,
  title:contract.title,
  category:classifyPredictionContract(contract),
  venue:contract.source,
  probability:contract.yesProbability,
  bidProbability:bid,
  askProbability:ask,
  spread,
  volume:contract.volume??null,
  liquidity:contract.liquidity??null,
  depthScore:Math.log10(1+contractDepth(contract)),
  expiresAt:contract.expiresAt??null
 };
}

export async function GET(req:Request){
 const url=new URL(req.url);
 const maxTrades=Math.max(50,Math.min(500,Number(url.searchParams.get('trades')||300)));
 const maxMarkets=Math.max(50,Math.min(1000,Number(url.searchParams.get('markets')||300)));
 const requestedCategory=(url.searchParams.get('category')||'ALL').toUpperCase();

 const [predictions,kalshi,polymarket,leaderboard,warehouse]=await Promise.all([
  fetchPredictionMarkets(),
  fetchKalshiTrades(maxTrades),
  fetchPolymarketTrades(maxTrades),
  fetchPolymarketLeaderboard('week',100),
  predictionWarehouseStats()
 ]);

 const trades=enrichKalshiTradeTitles(
  [...kalshi.trades,...polymarket.trades]
   .sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()),
  predictions.contracts
 );

 const windows:FlowWindow[]=['1H','4H','12H','24H'];
 const flow=Object.fromEntries(windows.map(window=>[window,summarizeFlow(trades,window).slice(0,50)]));
 const smartFlow=convictionTrades(trades,50);
 const movers=marketMovers(trades,'4H',50);
 const gaps=crossVenueGaps(predictions.contracts,50);
 const traderSignals=buildTraderSignals(trades,leaderboard.rows,40);
 const decisionSignals=buildPredictionDecisionSignals(predictions.contracts,gaps,flow['4H']||[],movers,traderSignals,80);

 const rows=predictions.contracts.map(marketRow);
 const filtered=requestedCategory==='ALL'
  ?rows
  :rows.filter(x=>x.category===requestedCategory);
 const markets=[...filtered]
  .sort((a,b)=>(b.depthScore-a.depthScore)||(b.probability-a.probability))
  .slice(0,maxMarkets);

 const categoryMap=new Map<PredictionCategory,number>();
 for(const row of rows)categoryMap.set(row.category,(categoryMap.get(row.category)||0)+1);
 const categories=[...categoryMap.entries()]
  .map(([category,count])=>({category,count}))
  .sort((a,b)=>b.count-a.count);

 const kalshiContracts=predictions.contracts.filter(x=>x.source.toLowerCase()==='kalshi').length;
 const polymarketContracts=predictions.contracts.filter(x=>x.source.toLowerCase()==='polymarket').length;
 const tradeNotional24h=trades
  .filter(x=>Date.now()-new Date(x.timestamp).getTime()<=24*60*60*1000)
  .reduce((sum,x)=>sum+x.notional,0);

 return Response.json({
  ok:predictions.contracts.length>0,
  generatedAt:new Date().toISOString(),
  scope:'ALL_PREDICTION_MARKETS',
  executionEnabled:false,
  analyticsOnly:true,
  summary:{
   contracts:predictions.contracts.length,
   kalshiContracts,
   polymarketContracts,
   recentTrades:trades.length,
   tradeNotional24h,
   smartFlowSignals:smartFlow.length,
   crossVenueMatches:gaps.length,
   strongCrossVenueMatches:gaps.filter(x=>x.matchQuality==='STRONG').length,
   movers:movers.length,
   rankedTraders:leaderboard.rows.length,
   smartTraders:traderSignals.length,
   decisionSignals:decisionSignals.length,
   buyYesSignals:decisionSignals.filter(x=>x.action==='BUY_YES').length,
   buyNoSignals:decisionSignals.filter(x=>x.action==='BUY_NO').length,
   gradeASignals:decisionSignals.filter(x=>x.evidenceGrade==='A').length,
   warehouseMarkets:warehouse.markets,
   warehouseSnapshots:warehouse.snapshots,
   warehouseTrades:warehouse.trades,
   warehouseTraders:warehouse.traders,
   warehouseSignals:warehouse.signals,
   warehouseBuySignals:warehouse.buySignals
  },
  categories,
  markets,
  flow,
  smartFlow,
  movers,
  traderSignals,
  decisionSignals,
  traderLeaderboard:leaderboard.rows.slice(0,100),
  crossVenueGaps:gaps,
  tradeTape:trades.slice(0,100),
  warehouse,
  sources:{
   predictionMarkets:predictions.sources||[],
   kalshiTrades:{ok:kalshi.ok,count:kalshi.trades.length,error:kalshi.error||null},
   polymarketTrades:{ok:polymarket.ok,count:polymarket.trades.length,error:polymarket.error||null},
   polymarketLeaderboard:{ok:leaderboard.ok,count:leaderboard.rows.length,error:leaderboard.error||null}
  },
  warnings:[
   ...(predictions.warnings||[]),
   ...(!kalshi.ok&&kalshi.error?['Kalshi trade tape: '+kalshi.error]:[]),
   ...(!polymarket.ok&&polymarket.error?['Polymarket trade tape: '+polymarket.error]:[]),
   ...(!leaderboard.ok&&leaderboard.error?['Polymarket leaderboard: '+leaderboard.error]:[]),
   'BUY YES / BUY NO signals require a strong cross-venue match, executable bid/ask, minimum market depth, spread discipline, and positive model-relative edge. They are decision support, not guaranteed profit.',
   'Cross-venue matches still require verification of contract wording, deadline, fees, fills and settlement source before treating exposure as equivalent.'
  ]
 },{headers:{'Cache-Control':'no-store'}});
}
