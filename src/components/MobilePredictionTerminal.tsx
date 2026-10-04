'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {buildTradeSignal} from '@/lib/tradeSignals';

type Summary={
 contracts:number;
 kalshiContracts:number;
 polymarketContracts:number;
 recentTrades:number;
 tradeNotional24h:number;
 smartFlowSignals:number;
 crossVenueMatches:number;
 strongCrossVenueMatches:number;
 movers:number;
 rankedTraders:number;
 smartTraders:number;
 warehouseMarkets:number;
 warehouseSnapshots:number;
 warehouseTrades:number;
 warehouseTraders:number;
};

type Category={category:string;count:number};
type Market={
 id:string;title:string;category:string;venue:string;probability:number;
 bidProbability?:number;askProbability?:number;spread?:number;
 volume?:number|null;liquidity?:number|null;expiresAt?:string|null;
};
type Trade={
 id:string;venue:string;marketId:string;title:string;outcome?:string;
 direction:string;price:number;size:number;notional:number;signedYesFlow:number;
 timestamp:string;traderId?:string;convictionMultiple?:number;
};
type Gap={
 kalshi:{id:string;title:string;yesProbability:number};
 polymarket:{id:string;title:string;yesProbability:number};
 similarity:number;absoluteGap:number;lowerVenue:string;higherVenue:string;
 lowerProbability:number;higherProbability:number;matchQuality:string;
};
type Mover={
 venue:string;marketId:string;title:string;window:string;trades:number;
 grossNotional:number;netYesFlow:number;startYesProbability:number;
 latestYesProbability:number;probabilityChange:number;absoluteChange:number;lastTradeAt:string;
};
type TraderSignal={
 traderId:string;name?:string;rank?:number;pnl?:number;publicVolume?:number;verified?:boolean;
 recentTrades:number;recentNotional:number;averageTradeNotional:number;maxTradeNotional:number;
 convictionMultiple:number;smartScore:number;
 latestTrade:{marketId:string;title:string;direction:string;price:number;notional:number;timestamp:string};
};
type TerminalResponse={
 ok:boolean;generatedAt:string;summary:Summary;categories:Category[];markets:Market[];
 smartFlow:Array<Trade&{convictionMultiple:number}>;movers:Mover[];traderSignals:TraderSignal[];
 crossVenueGaps:Gap[];tradeTape:Trade[];
 warehouse?:{configured:boolean;markets:number;snapshots:number;trades:number;traders:number};
 warnings:string[];
};

type SportsSignalRow={
 id:string;sport:string;event:string;selection:string;market:string;simProbability:number;
 dynamicConfidence:number;grade:'ELITE'|'STRONG'|'WATCH'|'PASS';regime:string;freshness:string;
 contextQuality?:{recommendationReady?:boolean;coverage?:number};
 bestExecutionVenue?:{venue:string;type:'SPORTSBOOK'|'PREDICTION_EXCHANGE';edge:number;expectedValue:number;marketProbability:number;americanOdds?:number;feeAdjusted:boolean};
 bestPredictionVenue?:{volume?:number;liquidity?:number;status:string};
 lineMovement?:{direction:'TOWARD'|'AWAY'|'FLAT';steam:boolean;steamStrength:'NONE'|'WATCH'|'STRONG';probabilityMove:number;snapshotCount:number}|null;
};
type SportsBoardResponse={rows:SportsSignalRow[];generatedAt:string};
type PositionIntel={
 position:{id:number;venue:string;title:string;category:string;side:'YES'|'NO';quantity:number;avgEntryProbability:number};
 current?:{executableExitProbability:number;executableBuyProbability:number};
 fair?:{sideProbability:number;source:string;confidence:number};
 action:'ADD'|'HOLD'|'TRIM'|'TAKE_PROFIT'|'EXIT'|'NO_SIGNAL';
 timing:'NOW'|'PATIENT'|'REVIEW';score:number;remainingEdge:number;unrealizedPnl:number;unrealizedRoi:number;
 addBelowProbability:number;takeProfitAboveProbability:number;riskFlags:string[];
};
type PositionResponse={
 ok:boolean;summary:{openPositions:number;add:number;hold:number;trim:number;takeProfit:number;exit:number;noSignal:number;unrealizedPnl:number};
 intelligence:PositionIntel[];
};

const empty:TerminalResponse={
 ok:false,generatedAt:'',summary:{
  contracts:0,kalshiContracts:0,polymarketContracts:0,recentTrades:0,tradeNotional24h:0,
  smartFlowSignals:0,crossVenueMatches:0,strongCrossVenueMatches:0,movers:0,rankedTraders:0,
  smartTraders:0,warehouseMarkets:0,warehouseSnapshots:0,warehouseTrades:0,warehouseTraders:0
 },
 categories:[],markets:[],smartFlow:[],movers:[],traderSignals:[],crossVenueGaps:[],tradeTape:[],warnings:[]
};

function pct(n:number){return (n*100).toFixed(1)+'%'}
function money(n:number){
 if(!Number.isFinite(n))return '$0';
 if(Math.abs(n)>=1_000_000)return '$'+(n/1_000_000).toFixed(1)+'M';
 if(Math.abs(n)>=1_000)return '$'+(n/1_000).toFixed(1)+'K';
 return '$'+n.toFixed(0);
}
function timeAgo(value:string){
 const ms=Date.now()-new Date(value).getTime();
 if(!Number.isFinite(ms)||ms<0)return 'now';
 const m=Math.floor(ms/60000);
 if(m<1)return 'now';
 if(m<60)return m+'m';
 const h=Math.floor(m/60);
 if(h<24)return h+'h';
 return Math.floor(h/24)+'d';
}

export default function MobilePredictionTerminal(){
 const [data,setData]=useState<TerminalResponse>(empty);
 const [category,setCategory]=useState('ALL');
 const [tab,setTab]=useState<'SIGNALS'|'POSITIONS'|'FLOW'|'MOVERS'|'TRADERS'|'GAPS'|'MARKETS'|'TAPE'>('SIGNALS');
 const [sportsRows,setSportsRows]=useState<SportsSignalRow[]>([]);
 const [positionData,setPositionData]=useState<PositionResponse|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  let busy=false;
  const load=async()=>{
   if(busy)return;
   busy=true;
   try{
    const [terminalRes,sportsRes,positionRes]=await Promise.all([
     fetch('/api/prediction-terminal?markets=300&trades=300',{cache:'no-store'}),
     fetch('/api/live-board?view=today&limit=30&risk=Moderate',{cache:'no-store'}),
     fetch('/api/prediction-positions/intelligence',{cache:'no-store'})
    ]);
    if(!terminalRes.ok)throw new Error('Prediction terminal request failed');
    const json=await terminalRes.json() as TerminalResponse;
    const sportsJson=sportsRes.ok?await sportsRes.json() as SportsBoardResponse:null;
    const positionsJson=positionRes.ok?await positionRes.json() as PositionResponse:null;
    if(active){setData(json);setSportsRows(sportsJson?.rows||[]);setPositionData(positionsJson);setError('')}
   }catch(e){
    if(active)setError(e instanceof Error?e.message:'Unable to refresh');
   }finally{busy=false}
  };
  void load();
  const timer=window.setInterval(()=>void load(),30000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const markets=useMemo(()=>category==='ALL'?data.markets:data.markets.filter(x=>x.category===category),[data.markets,category]);
 const sportsSignals=useMemo(()=>sportsRows
  .map(row=>({row,signal:buildTradeSignal(row)}))
  .sort((a,b)=>b.signal.score-a.signal.score||b.signal.expectedValue-a.signal.expectedValue),[sportsRows]);
 const latest=data.generatedAt?timeAgo(data.generatedAt):'—';

 return <main className="pmMobile">
  <header className="pmTop">
   <div>
    <div className="pmEyebrow">EDGEFORCE PREDICTION INTELLIGENCE</div>
    <h1>Market Terminal</h1>
   </div>
   <div className="pmLive"><span/>LIVE · {latest}</div>
  </header>

  {error&&<div className="pmAlert">{error}</div>}
  {data.warnings?.length>0&&<div className="pmNotice">{data.warnings[0]}</div>}

  <section className="pmHero">
   <div>
    <small>TRACKED MARKETS</small>
    <strong>{data.summary.contracts.toLocaleString()}</strong>
    <span>Kalshi + Polymarket across every category</span>
   </div>
   <div className="pmHeroStats">
    <div><small>Kalshi</small><b>{data.summary.kalshiContracts.toLocaleString()}</b></div>
    <div><small>Poly</small><b>{data.summary.polymarketContracts.toLocaleString()}</b></div>
    <div><small>24H flow</small><b>{money(data.summary.tradeNotional24h)}</b></div>
    <div><small>Signals</small><b>{data.summary.smartFlowSignals}</b></div>
   </div>
  </section>

  <section className="pmCategories">
   <button className={category==='ALL'?'active':''} onClick={()=>setCategory('ALL')}>ALL</button>
   {data.categories.slice(0,12).map(x=>
    <button key={x.category} className={category===x.category?'active':''} onClick={()=>setCategory(x.category)}>
     {x.category}<span>{x.count}</span>
    </button>
   )}
  </section>

  <nav className="pmTabs">
   <button className={tab==='SIGNALS'?'active':''} onClick={()=>setTab('SIGNALS')}>Pro Signals</button>
   <button className={tab==='POSITIONS'?'active':''} onClick={()=>setTab('POSITIONS')}>Positions</button>
   <button className={tab==='FLOW'?'active':''} onClick={()=>setTab('FLOW')}>Smart Flow</button>
   <button className={tab==='MOVERS'?'active':''} onClick={()=>setTab('MOVERS')}>Movers</button>
   <button className={tab==='TRADERS'?'active':''} onClick={()=>setTab('TRADERS')}>Traders</button>
   <button className={tab==='GAPS'?'active':''} onClick={()=>setTab('GAPS')}>Venue Gaps</button>
   <button className={tab==='MARKETS'?'active':''} onClick={()=>setTab('MARKETS')}>Markets</button>
   <button className={tab==='TAPE'?'active':''} onClick={()=>setTab('TAPE')}>Tape</button>
  </nav>

  {tab==='SIGNALS'&&<section className="pmStack">
   <div className="pmSectionHead"><div><small>EDGEFORCE SPORTS</small><h2>Buy / bet / exit signals</h2></div><span>{sportsSignals.length}</span></div>
   {sportsSignals.slice(0,30).map(({row,signal})=><article className="pmCard" key={'sports-signal-'+row.id}>
    <div className="pmCardTop"><span className={'pmMatch '+(signal.action==='BUY'||signal.action==='BET'?'strong':'heuristic')}>{signal.action} · {signal.timing}</span><b className="pmGap">{signal.score}/100</b></div>
    <h3>{row.selection}</h3>
    <div className="pmMetrics">
     <div><small>Sport</small><b>{row.sport}</b></div>
     <div><small>Fair</small><b>{pct(signal.fairProbability)}</b></div>
     <div><small>Market</small><b>{pct(signal.marketProbability)}</b></div>
     <div><small>EV</small><b className={signal.expectedValue>=0?'up':'down'}>{signal.expectedValue>=0?'+':''}{pct(signal.expectedValue)}</b></div>
    </div>
    <p>{signal.venue} · entry {signal.venueType==='PREDICTION_EXCHANGE'?'≤ '+Math.round(signal.entryMaxProbability*100)+'¢':'at/above '+signal.entryMinAmericanOdds+' odds'} · confidence {pct(signal.confidence)}{row.lineMovement?.steam?' · '+row.lineMovement.steamStrength+' steam '+row.lineMovement.direction.toLowerCase():''}</p>
   </article>)}
   {!sportsSignals.length&&<div className="pmEmpty">No qualified sports signals are available in the current board.</div>}
  </section>}

  {tab==='POSITIONS'&&<section className="pmStack">
   <div className="pmSectionHead"><div><small>POSITION-AWARE</small><h2>Add / hold / trim / exit</h2></div><span>{positionData?.summary.openPositions??0}</span></div>
   <article className="pmCard">
    <div className="pmCardTop"><span className="pmMatch strong">LIVE PORTFOLIO</span><b className={(positionData?.summary.unrealizedPnl??0)>=0?'up':'down'}>{money(positionData?.summary.unrealizedPnl??0)}</b></div>
    <div className="pmMetrics">
     <div><small>Add</small><b>{positionData?.summary.add??0}</b></div>
     <div><small>Hold</small><b>{positionData?.summary.hold??0}</b></div>
     <div><small>Reduce</small><b>{(positionData?.summary.trim??0)+(positionData?.summary.takeProfit??0)}</b></div>
     <div><small>Exit</small><b>{positionData?.summary.exit??0}</b></div>
    </div>
   </article>
   {(positionData?.intelligence||[]).slice(0,40).map(item=><article className="pmCard" key={'position-'+item.position.id}>
    <div className="pmCardTop"><span className={'pmMatch '+(item.action==='ADD'||item.action==='HOLD'?'strong':'heuristic')}>{item.action} · {item.timing}</span><b className="pmGap">{item.score}/100</b></div>
    <h3>{item.position.side} · {item.position.title}</h3>
    <div className="pmMetrics">
     <div><small>Venue</small><b>{item.position.venue}</b></div>
     <div><small>Entry</small><b>{pct(item.position.avgEntryProbability)}</b></div>
     <div><small>Exit now</small><b>{item.current?pct(item.current.executableExitProbability):'—'}</b></div>
     <div><small>P/L</small><b className={item.unrealizedPnl>=0?'up':'down'}>{money(item.unrealizedPnl)}</b></div>
    </div>
    <p>{'fair '+(item.fair?pct(item.fair.sideProbability):'—')+' • add ≤ '+pct(item.addBelowProbability)+' • take-profit review ≥ '+pct(item.takeProfitAboveProbability)}{item.fair?' • '+item.fair.source:''}</p>
   </article>)}
   {!positionData?.intelligence?.length&&<div className="pmEmpty">No open prediction positions are recorded yet.</div>}
  </section>}

  {tab==='FLOW'&&<section className="pmStack">
   <div className="pmSectionHead"><div><small>CONVICTION</small><h2>Smart-money flow</h2></div><span>{data.smartFlow.length}</span></div>
   {data.smartFlow.slice(0,30).map(row=><article className="pmCard" key={row.id}>
    <div className="pmCardTop"><span className={'pmVenue '+row.venue.toLowerCase()}>{row.venue}</span><time>{timeAgo(row.timestamp)}</time></div>
    <h3>{row.title}</h3>
    <div className="pmMetrics">
     <div><small>Direction</small><b className={row.signedYesFlow>=0?'up':'down'}>{row.direction}</b></div>
     <div><small>Notional</small><b>{money(row.notional)}</b></div>
     <div><small>Price</small><b>{pct(row.price)}</b></div>
     <div><small>Conviction</small><b>{row.convictionMultiple.toFixed(1)}×</b></div>
    </div>
    {row.traderId&&<div className="pmWallet">Trader {row.traderId.slice(0,8)}…{row.traderId.slice(-5)}</div>}
   </article>)}
   {!data.smartFlow.length&&<div className="pmEmpty">No high-conviction public-flow signals in the current tape.</div>}
  </section>}

  {tab==='MOVERS'&&<section className="pmStack">
   <div className="pmSectionHead"><div><small>4H PRICE ACTION</small><h2>Market movers</h2></div><span>{data.movers.length}</span></div>
   {data.movers.slice(0,40).map(row=><article className="pmCard" key={row.venue+'-'+row.marketId}>
    <div className="pmCardTop"><span className={'pmVenue '+row.venue.toLowerCase()}>{row.venue}</span><time>{timeAgo(row.lastTradeAt)}</time></div>
    <h3>{row.title}</h3>
    <div className="pmMetrics">
     <div><small>Move</small><b className={row.probabilityChange>=0?'up':'down'}>{row.probabilityChange>=0?'+':''}{(row.probabilityChange*100).toFixed(1)} pts</b></div>
     <div><small>Now</small><b>{pct(row.latestYesProbability)}</b></div>
     <div><small>Flow</small><b className={row.netYesFlow>=0?'up':'down'}>{money(row.netYesFlow)}</b></div>
     <div><small>Volume</small><b>{money(row.grossNotional)}</b></div>
    </div>
   </article>)}
   {!data.movers.length&&<div className="pmEmpty">No qualifying market movers in the current trade window.</div>}
  </section>}

  {tab==='TRADERS'&&<section className="pmStack">
   <div className="pmSectionHead"><div><small>POLYMARKET SMART MONEY</small><h2>Trader intelligence</h2></div><span>{data.traderSignals.length}</span></div>
   {data.traderSignals.slice(0,40).map(row=><article className="pmCard" key={row.traderId}>
    <div className="pmCardTop">
     <span className="pmVenue polymarket">{row.verified?'VERIFIED':'POLY'}</span>
     <b className="pmGap">{pct(row.smartScore)}</b>
    </div>
    <h3>{row.name||row.traderId.slice(0,10)+'…'}</h3>
    <div className="pmMetrics">
     <div><small>Rank</small><b>{row.rank?'#'+row.rank:'—'}</b></div>
     <div><small>Public P&L</small><b className={(row.pnl??0)>=0?'up':'down'}>{row.pnl===undefined?'—':money(row.pnl)}</b></div>
     <div><small>Recent flow</small><b>{money(row.recentNotional)}</b></div>
     <div><small>Conviction</small><b>{row.convictionMultiple.toFixed(1)}×</b></div>
    </div>
    <div className="pmWallet">{row.traderId}</div>
    <p>Latest: {row.latestTrade.direction} · {row.latestTrade.title}</p>
   </article>)}
   {!data.traderSignals.length&&<div className="pmEmpty">No trader-linked smart-money signals are available in the current Polymarket tape.</div>}
  </section>}

  {tab==='GAPS'&&<section className="pmStack">
   <div className="pmSectionHead"><div><small>CROSS-VENUE</small><h2>Probability gaps</h2></div><span>{data.summary.strongCrossVenueMatches} strong</span></div>
   {data.crossVenueGaps.slice(0,30).map((row,index)=><article className="pmCard" key={row.kalshi.id+'-'+row.polymarket.id+'-'+index}>
    <div className="pmCardTop"><span className={'pmMatch '+row.matchQuality.toLowerCase()}>{row.matchQuality}</span><b className="pmGap">{(row.absoluteGap*100).toFixed(1)} pts</b></div>
    <h3>{row.kalshi.title}</h3>
    <div className="pmCompare">
     <div><small>Kalshi</small><b>{pct(row.kalshi.yesProbability)}</b></div>
     <div><small>Polymarket</small><b>{pct(row.polymarket.yesProbability)}</b></div>
     <div><small>Text match</small><b>{pct(row.similarity)}</b></div>
    </div>
    <p>Research candidate only — verify identical wording, deadline, and settlement source.</p>
   </article>)}
   {!data.crossVenueGaps.length&&<div className="pmEmpty">No comparable cross-venue markets found in the current sample.</div>}
  </section>}

  {tab==='MARKETS'&&<section className="pmStack">
   <div className="pmSectionHead"><div><small>{category}</small><h2>Market scanner</h2></div><span>{markets.length}</span></div>
   {markets.slice(0,50).map(row=><article className="pmCard compact" key={row.venue+'-'+row.id}>
    <div className="pmCardTop"><span className={'pmVenue '+row.venue.toLowerCase()}>{row.venue}</span><span>{row.category}</span></div>
    <h3>{row.title}</h3>
    <div className="pmCompare">
     <div><small>YES</small><b>{pct(row.probability)}</b></div>
     <div><small>Volume</small><b>{row.volume?money(row.volume):'—'}</b></div>
     <div><small>Liquidity</small><b>{row.liquidity?money(row.liquidity):'—'}</b></div>
    </div>
   </article>)}
  </section>}

  {tab==='TAPE'&&<section className="pmStack">
   <div className="pmSectionHead"><div><small>LIVE PRINTS</small><h2>Trade tape</h2></div><span>{data.tradeTape.length}</span></div>
   {data.tradeTape.slice(0,60).map(row=><article className="pmTape" key={row.id}>
    <div><span className={'pmVenue '+row.venue.toLowerCase()}>{row.venue}</span><time>{timeAgo(row.timestamp)}</time></div>
    <h3>{row.title}</h3>
    <footer><b className={row.signedYesFlow>=0?'up':'down'}>{row.direction}</b><span>{money(row.notional)}</span><span>@ {pct(row.price)}</span></footer>
   </article>)}
  </section>}

  <section className="pmInstall">
   <b>iPhone install</b>
   <span>Open in Safari → Share → Add to Home Screen. Edgeforce then opens full-screen like an app.</span>
  </section>
  <footer className="pmFooter">
   <span>Analytics only · no automatic execution</span>
   <Link href="/">Desktop Edgeforce</Link>
  </footer>
 </main>
}
