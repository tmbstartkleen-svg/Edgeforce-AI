'use client';

import {useEffect,useMemo,useState} from 'react';

type Summary={
 contracts:number;
 kalshiContracts:number;
 polymarketContracts:number;
 recentTrades:number;
 tradeNotional24h:number;
 smartFlowSignals:number;
 crossVenueMatches:number;
 strongCrossVenueMatches:number;
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
type TerminalResponse={
 ok:boolean;generatedAt:string;summary:Summary;categories:Category[];markets:Market[];
 smartFlow:Array<Trade&{convictionMultiple:number}>;crossVenueGaps:Gap[];tradeTape:Trade[];
 warnings:string[];
};

const empty:TerminalResponse={
 ok:false,generatedAt:'',summary:{contracts:0,kalshiContracts:0,polymarketContracts:0,recentTrades:0,tradeNotional24h:0,smartFlowSignals:0,crossVenueMatches:0,strongCrossVenueMatches:0},
 categories:[],markets:[],smartFlow:[],crossVenueGaps:[],tradeTape:[],warnings:[]
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
 const [tab,setTab]=useState<'FLOW'|'GAPS'|'MARKETS'|'TAPE'>('FLOW');
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  let busy=false;
  const load=async()=>{
   if(busy)return;
   busy=true;
   try{
    const res=await fetch('/api/prediction-terminal?markets=300&trades=300',{cache:'no-store'});
    if(!res.ok)throw new Error('Prediction terminal request failed');
    const json=await res.json() as TerminalResponse;
    if(active){setData(json);setError('')}
   }catch(e){
    if(active)setError(e instanceof Error?e.message:'Unable to refresh');
   }finally{busy=false}
  };
  void load();
  const timer=window.setInterval(()=>void load(),30000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const markets=useMemo(()=>category==='ALL'?data.markets:data.markets.filter(x=>x.category===category),[data.markets,category]);
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
   <button className={tab==='FLOW'?'active':''} onClick={()=>setTab('FLOW')}>Smart Flow</button>
   <button className={tab==='GAPS'?'active':''} onClick={()=>setTab('GAPS')}>Venue Gaps</button>
   <button className={tab==='MARKETS'?'active':''} onClick={()=>setTab('MARKETS')}>Markets</button>
   <button className={tab==='TAPE'?'active':''} onClick={()=>setTab('TAPE')}>Tape</button>
  </nav>

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

  <footer className="pmFooter">
   <span>Analytics only · no automatic execution</span>
   <a href="/">Desktop Edgeforce</a>
  </footer>
 </main>
}
