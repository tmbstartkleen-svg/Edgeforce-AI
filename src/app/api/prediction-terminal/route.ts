import {fetchPredictionMarkets,type PredictionContract} from '@/lib/predictionMarkets';
import {
 convictionTrades,crossVenueGaps,enrichKalshiTradeTitles,
 fetchKalshiTrades,fetchPolymarketTrades,summarizeFlow,type FlowWindow
} from '@/lib/predictionFlow';

export const dynamic='force-dynamic';

type PredictionCategory=
 |'SPORTS'|'POLITICS'|'ECONOMICS'|'CRYPTO'|'WEATHER'|'TECH'
 |'ENTERTAINMENT'|'GEOPOLITICS'|'SCIENCE'|'LEGAL'|'FINANCE'|'OTHER';

const CATEGORY_RULES:Array<[PredictionCategory,RegExp]>= [
 ['SPORTS',/\\b(nfl|nba|wnba|mlb|nhl|ncaa|football|basketball|baseball|hockey|soccer|tennis|ufc|mma|golf|world cup|super bowl|championship|playoffs?)\\b/i],
 ['POLITICS',/\\b(election|president|senate|house|congress|governor|democrat|republican|primary|nominee|vote|ballot|poll)\\b/i],
 ['ECONOMICS',/\\b(fed|federal reserve|inflation|cpi|gdp|unemployment|jobs report|interest rate|rate cut|rate hike|recession|tariff)\\b/i],
 ['CRYPTO',/\\b(bitcoin|btc|ethereum|eth|crypto|solana|sol|token|blockchain|dogecoin|xrp)\\b/i],
 ['WEATHER',/\\b(weather|temperature|rain|snow|hurricane|storm|tornado|precipitation|heat|cold|wind)\\b/i],
 ['TECH',/\\b(ai|artificial intelligence|openai|apple|google|microsoft|nvidia|tesla|spacex|launch|iphone|software|chip|semiconductor)\\b/i],
 ['ENTERTAINMENT',/\\b(movie|film|box office|oscar|emmy|grammy|album|song|celebrity|netflix|tv|show|award)\\b/i],
 ['GEOPOLITICS',/\\b(war|ceasefire|invasion|ukraine|russia|china|taiwan|israel|iran|nato|sanction|treaty|military)\\b/i],
 ['SCIENCE',/\\b(science|space|nasa|climate|vaccine|fda|drug|trial|research|asteroid|moon|mars)\\b/i],
 ['LEGAL',/\\b(court|supreme court|lawsuit|ruling|judge|indictment|conviction|trial|legal|ban|regulation)\\b/i],
 ['FINANCE',/\\b(stock|s&p|nasdaq|dow|oil|gold|treasury|yield|earnings|ipo|market cap|mortgage|bond)\\b/i]
];

function classify(contract:PredictionContract):PredictionCategory{
 const text=contract.category+' '+contract.title;
 for(const [category,pattern] of CATEGORY_RULES)if(pattern.test(text))return category;
 return 'OTHER';
}

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
  category:classify(contract),
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

 const [predictions,kalshi,polymarket]=await Promise.all([
  fetchPredictionMarkets(),
  fetchKalshiTrades(maxTrades),
  fetchPolymarketTrades(maxTrades)
 ]);

 const trades=enrichKalshiTradeTitles(
  [...kalshi.trades,...polymarket.trades]
   .sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()),
  predictions.contracts
 );

 const windows:FlowWindow[]=['1H','4H','12H','24H'];
 const flow=Object.fromEntries(windows.map(window=>[window,summarizeFlow(trades,window).slice(0,50)]));
 const smartFlow=convictionTrades(trades,50);
 const gaps=crossVenueGaps(predictions.contracts,50);

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
   strongCrossVenueMatches:gaps.filter(x=>x.matchQuality==='STRONG').length
  },
  categories,
  markets,
  flow,
  smartFlow,
  crossVenueGaps:gaps,
  tradeTape:trades.slice(0,100),
  sources:{
   predictionMarkets:predictions.sources||[],
   kalshiTrades:{ok:kalshi.ok,count:kalshi.trades.length,error:kalshi.error||null},
   polymarketTrades:{ok:polymarket.ok,count:polymarket.trades.length,error:polymarket.error||null}
  },
  warnings:[
   ...(predictions.warnings||[]),
   ...(!kalshi.ok&&kalshi.error?['Kalshi trade tape: '+kalshi.error]:[]),
   ...(!polymarket.ok&&polymarket.error?['Polymarket trade tape: '+polymarket.error]:[]),
   'Cross-venue matches are research candidates only. Verify contract wording, deadline and settlement source before treating a price gap as equivalent exposure.'
  ]
 },{headers:{'Cache-Control':'no-store'}});
}
