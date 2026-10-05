'use client';

import {useEffect,useMemo,useState} from 'react';

type Row={
 domain:'SPORTS'|'MARKETS';dimension:'CATEGORY'|'VENUE';key:string;samples:number;positiveRate:number;
 averageCapturePoints:number;medianCapturePoints:number;confidence:number;multiplier:number;
 state:'BOOST'|'NEUTRAL'|'REDUCE'|'INSUFFICIENT';
};
type Payload={configured:boolean;rows:Row[]};

const pct=(n:number)=>(n*100).toFixed(1)+'%';

export default function ExecutionFeedbackPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/execution-feedback',{cache:'no-store'});
    if(!res.ok)throw new Error('execution feedback unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'execution feedback unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),120000);
  return()=>{active=false;window.clearInterval(timer)};
 },[]);

 const categoryRows=useMemo(()=>[...(data?.rows||[])].filter(x=>x.dimension==='CATEGORY').sort((a,b)=>b.multiplier-a.multiplier).slice(0,10),[data]);
 const venueRows=useMemo(()=>[...(data?.rows||[])].filter(x=>x.dimension==='VENUE').sort((a,b)=>b.multiplier-a.multiplier).slice(0,10),[data]);

 const render=(rows:Row[])=>rows.map(x=><div className="historyRow" key={x.domain+'|'+x.dimension+'|'+x.key}>
  <span>{x.key}</span><b>{x.state} · {x.multiplier.toFixed(3)}×</b>
  <small>{x.domain} • n={x.samples} • positive CLV {pct(x.positiveRate)}</small>
  <small>avg {x.averageCapturePoints>=0?'+':''}{x.averageCapturePoints.toFixed(2)} pts • median {x.medianCapturePoints>=0?'+':''}{x.medianCapturePoints.toFixed(2)} pts • confidence {pct(x.confidence)}</small>
 </div>);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V111 EXECUTION FEEDBACK</div><h3>CLV-Aware Strategy & Venue Reweighting</h3></div>
   <div className="panelMeta"><span>Outcome skill stays primary</span><span>CLV bounded</span></div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="historyGrid">
   <div className="historyBox"><h4>Category feedback</h4>{render(categoryRows)}{!categoryRows.length&&<div className="historyRow"><span>Insufficient category CLV history</span><b>NEUTRAL</b><small>No execution adjustment is applied without enough history.</small></div>}</div>
   <div className="historyBox"><h4>Venue feedback</h4>{render(venueRows)}{!venueRows.length&&<div className="historyRow"><span>Insufficient venue CLV history</span><b>NEUTRAL</b><small>Venue rankings will appear as price-capture history accumulates.</small></div>}</div>
  </div>
  <div className="historyNote">V111 only nudges analytical routing. A strong closing-line-value record cannot rescue a badly calibrated model, and a weak short-term CLV sample cannot shut down a validated strategy.</div>
 </section>;
}
