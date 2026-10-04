'use client';

import {useEffect,useState} from 'react';

type SmartFlow={
 id:string;venue:string;title:string;direction:string;price:number;notional:number;
 signedYesFlow:number;timestamp:string;convictionMultiple:number;traderId?:string;
};
type TraderSignal={
 traderId:string;name?:string;rank?:number;pnl?:number;recentNotional:number;
 convictionMultiple:number;smartScore:number;verified?:boolean;
 latestTrade:{title:string;direction:string};
};
type Gap={
 kalshi:{title:string;yesProbability:number};
 polymarket:{yesProbability:number};
 absoluteGap:number;matchQuality:string;
};
type Mover={
 venue:string;title:string;probabilityChange:number;latestYesProbability:number;
 netYesFlow:number;grossNotional:number;
};
type Response={
 ok:boolean;
 summary:{contracts:number;smartFlowSignals:number;strongCrossVenueMatches:number;smartTraders:number;tradeNotional24h:number};
 smartFlow:SmartFlow[];
 traderSignals:TraderSignal[];
 crossVenueGaps:Gap[];
 movers:Mover[];
 warnings:string[];
};

function pct(n:number){return (n*100).toFixed(1)+'%'}
function money(n:number|undefined){
 if(n===undefined||!Number.isFinite(n))return '—';
 const abs=Math.abs(n);
 if(abs>=1_000_000)return (n<0?'-$':'$')+(abs/1_000_000).toFixed(1)+'M';
 if(abs>=1_000)return (n<0?'-$':'$')+(abs/1_000).toFixed(1)+'K';
 return (n<0?'-$':'$')+abs.toFixed(0);
}

export default function PredictionIntelligencePanel(){
 const [data,setData]=useState<Response|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/prediction-terminal?markets=150&trades=200',{cache:'no-store'});
    if(!res.ok)throw new Error('prediction intelligence unavailable');
    const json=await res.json() as Response;
    if(active){setData(json);setError('')}
   }catch(e){
    if(active)setError(e instanceof Error?e.message:'prediction intelligence unavailable');
   }
  };
  void load();
  const timer=window.setInterval(()=>void load(),30000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">PREDICTION-MARKET ANALYST TERMINAL</div>
    <h3>Smart money, trader performance, movers, and cross-venue dislocations</h3>
   </div>
   <div className="panelMeta">
    <span>{data?.summary.contracts??0} markets</span>
    <span>{data?.summary.smartTraders??0} trader signals</span>
    <span>{money(data?.summary.tradeNotional24h)} 24h tracked flow</span>
   </div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="v21Grid four">
   <div className="v21Card">
    <div className="v21CardHead"><div><div className="eyebrow">SMART FLOW</div><h3>High-conviction prints</h3></div><span className="miniBadge">{data?.summary.smartFlowSignals??0}</span></div>
    <div className="historyList">
     {(data?.smartFlow||[]).slice(0,6).map(x=><div className="historyRow" key={x.id}><span>{x.title}</span><b>{x.direction}</b><small>{x.venue} • {money(x.notional)} @ {pct(x.price)} • {x.convictionMultiple.toFixed(1)}× conviction</small></div>)}
     {!data?.smartFlow?.length&&<div className="historyRow"><span>No current smart-flow signal</span><b>—</b><small>Only qualifying public trade flow appears here.</small></div>}
    </div>
   </div>
   <div className="v21Card">
    <div className="v21CardHead"><div><div className="eyebrow">TRADER INTELLIGENCE</div><h3>Evidence-backed leaders</h3></div><span className="miniBadge">{data?.summary.smartTraders??0}</span></div>
    <div className="historyList">
     {(data?.traderSignals||[]).slice(0,6).map(x=><div className="historyRow" key={x.traderId}><span>{x.name||x.traderId.slice(0,10)+'…'}</span><b>{pct(x.smartScore)}</b><small>{x.rank?'#'+x.rank+' • ':''}{x.pnl===undefined?'P/L unavailable':money(x.pnl)+' public P/L'} • {money(x.recentNotional)} recent flow • {x.convictionMultiple.toFixed(1)}×</small></div>)}
     {!data?.traderSignals?.length&&<div className="historyRow"><span>No verified trader signal</span><b>—</b><small>Edgeforce does not invent trader performance when public evidence is unavailable.</small></div>}
    </div>
   </div>
   <div className="v21Card">
    <div className="v21CardHead"><div><div className="eyebrow">CROSS-VENUE</div><h3>Kalshi ↔ Polymarket gaps</h3></div><span className="miniBadge">{data?.summary.strongCrossVenueMatches??0} strong</span></div>
    <div className="historyList">
     {(data?.crossVenueGaps||[]).slice(0,6).map((x,i)=><div className="historyRow" key={x.kalshi.title+i}><span>{x.kalshi.title}</span><b>{(x.absoluteGap*100).toFixed(1)} pts</b><small>{x.matchQuality} match • Kalshi {pct(x.kalshi.yesProbability)} • Poly {pct(x.polymarket.yesProbability)} • verify settlement equivalence</small></div>)}
     {!data?.crossVenueGaps?.length&&<div className="historyRow"><span>No comparable venue gap</span><b>—</b><small>Only matched contract wording is compared.</small></div>}
    </div>
   </div>
   <div className="v21Card">
    <div className="v21CardHead"><div><div className="eyebrow">MOMENTUM</div><h3>Fastest probability movers</h3></div><span className="miniBadge">4H</span></div>
    <div className="historyList">
     {(data?.movers||[]).slice(0,6).map((x,i)=><div className="historyRow" key={x.venue+x.title+i}><span>{x.title}</span><b>{x.probabilityChange>=0?'+':''}{(x.probabilityChange*100).toFixed(1)} pts</b><small>{x.venue} • now {pct(x.latestYesProbability)} • flow {money(x.netYesFlow)} • gross {money(x.grossNotional)}</small></div>)}
     {!data?.movers?.length&&<div className="historyRow"><span>No material mover</span><b>—</b><small>Movement requires qualifying recent trade data.</small></div>}
    </div>
   </div>
  </div>
  <div className="historyNote">Trader and flow panels use public market data as context, not as proof of future profitability. Cross-venue gaps are research candidates unless bid/ask, fees, liquidity, wording, deadline and settlement source all align.</div>
 </section>;
}
