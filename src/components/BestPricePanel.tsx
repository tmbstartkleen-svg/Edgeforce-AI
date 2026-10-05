'use client';

import {useEffect,useMemo,useState} from 'react';

type Row={
 id:string;domain:'SPORTS'|'MARKETS';title:string;category:string;bestVenue:string;currentVenue:string;
 bestProbability:number;currentProbability:number;bestAmericanOdds?:number;currentAmericanOdds?:number;
 priceImprovementPoints:number;equivalentConfidence:number;freshnessScore:number;liquidityScore:number;
 spreadScore:number;executionQuality:string;executionScore:number;stale:boolean;reason:string;
};
type Payload={summary:{excellent:number;good:number;fair:number;poor:number;stale:number;improved:number};rows:Row[]};

const pct=(n:number)=>(n*100).toFixed(1)+'%';
const odds=(n?:number)=>n===undefined?'—':n>0?'+'+n:String(n);

export default function BestPricePanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/best-price',{cache:'no-store'});
    if(!res.ok)throw new Error('best-price engine unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'best-price engine unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),60000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const focus=useMemo(()=>[...(data?.rows||[])].sort((a,b)=>b.executionScore-a.executionScore).slice(0,14),[data]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V109 BEST AVAILABLE PRICE</div><h3>Book / Exchange Shopping & Execution Quality</h3></div>
   <div className="panelMeta"><span>Improved {data?.summary.improved||0}</span><span>Excellent {data?.summary.excellent||0}</span><span>Stale {data?.summary.stale||0}</span></div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="historyGrid">
   <div className="historyBox">
    <h4>Best current venues</h4>
    {focus.map(x=><div className="historyRow" key={x.id}>
     <span>{x.title}</span><b>{x.executionQuality}</b>
     <small>{x.domain} • {x.category} • best {x.bestVenue} • current {x.currentVenue}</small>
     <small>{x.domain==='SPORTS'
      ?'best '+odds(x.bestAmericanOdds)+' • current '+odds(x.currentAmericanOdds)
      :'best '+pct(x.bestProbability)+' • current '+pct(x.currentProbability)}
      {' • improvement '+x.priceImprovementPoints.toFixed(1)+' pts'}</small>
     <small>quality {pct(x.executionScore)} • equivalence {pct(x.equivalentConfidence)} • {x.reason}</small>
    </div>)}
    {!focus.length&&<div className="historyRow"><span>No comparable venues available</span><b>HOLD</b><small>EdgeForce will not claim a better price without a valid comparable quote.</small></div>}
   </div>
   <div className="historyBox">
    <h4>Execution-quality summary</h4>
    <div className="historyRow"><span>Excellent / Good</span><b>{(data?.summary.excellent||0)+(data?.summary.good||0)}</b><small>Strong quote quality, freshness and cross-venue comparability.</small></div>
    <div className="historyRow"><span>Fair</span><b>{data?.summary.fair||0}</b><small>Usable comparison with less depth, liquidity or freshness.</small></div>
    <div className="historyRow"><span>Poor / Stale</span><b>{(data?.summary.poor||0)+(data?.summary.stale||0)}</b><small>Do not rely on the quote without a fresh re-check.</small></div>
    <div className="historyRow"><span>Better price found</span><b>{data?.summary.improved||0}</b><small>At least one comparable venue improves the observed price.</small></div>
   </div>
  </div>
  <div className="historyNote">V109 compares prices and quote quality only. It does not connect to account balances, submit wagers, place orders, cash out, or trade automatically.</div>
 </section>;
}
