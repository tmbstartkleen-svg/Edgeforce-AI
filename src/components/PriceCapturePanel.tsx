'use client';

import {useEffect,useMemo,useState} from 'react';

type CaptureRow={
 id:string;domain:'SPORTS'|'MARKETS';category:string;venue:string;title:string;
 capturedValuePoints:number|null;capturedValuePct:number|null;observations:number;
 grade:'ELITE'|'POSITIVE'|'FLAT'|'NEGATIVE'|'INSUFFICIENT';benchmarkConfidence:number;reason:string;
};
type VenueRow={
 venue:string;domain:'SPORTS'|'MARKETS';samples:number;positiveSamples:number;positiveRate:number;
 averageCapturePoints:number;medianCapturePoints:number;confidence:number;rankScore:number;
};
type Payload={
 summary:{elite:number;positive:number;flat:number;negative:number;insufficient:number};
 rows:CaptureRow[];venueBenchmarks:VenueRow[];
};

const pct=(n:number)=>(n*100).toFixed(1)+'%';
const pts=(n:number|null)=>n===null?'—':(n>=0?'+':'')+n.toFixed(2)+' pts';

export default function PriceCapturePanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/price-capture',{cache:'no-store'});
    if(!res.ok)throw new Error('price capture benchmark unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'price capture benchmark unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),120000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const focus=useMemo(()=>[...(data?.rows||[])].filter(x=>x.grade!=='INSUFFICIENT').slice(0,12),[data]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V110 PRICE CAPTURE</div><h3>Closing-Line Value & Execution Benchmark</h3></div>
   <div className="panelMeta"><span>Elite {data?.summary.elite||0}</span><span>Positive {data?.summary.positive||0}</span><span>Negative {data?.summary.negative||0}</span></div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="historyGrid">
   <div className="historyBox">
    <h4>Captured value</h4>
    {focus.map(x=><div className="historyRow" key={x.id}>
     <span>{x.title}</span><b>{x.grade}</b>
     <small>{x.domain} • {x.category} • {x.venue} • capture {pts(x.capturedValuePoints)}</small>
     <small>observations {x.observations} • confidence {pct(x.benchmarkConfidence)} • {x.reason}</small>
    </div>)}
    {!focus.length&&<div className="historyRow"><span>Insufficient price history</span><b>BUILDING</b><small>V110 needs at least two historical best-price observations before benchmarking capture.</small></div>}
   </div>
   <div className="historyBox">
    <h4>Venue benchmarks</h4>
    {(data?.venueBenchmarks||[]).slice(0,10).map((x,i)=><div className="historyRow" key={x.domain+'|'+x.venue}>
     <span>#{i+1} · {x.venue}</span><b>{x.averageCapturePoints>=0?'+':''}{x.averageCapturePoints.toFixed(2)} pts</b>
     <small>{x.domain} • n={x.samples} • positive {pct(x.positiveRate)}</small>
     <small>median {x.medianCapturePoints>=0?'+':''}{x.medianCapturePoints.toFixed(2)} pts • confidence {pct(x.confidence)}</small>
    </div>)}
    {!data?.venueBenchmarks?.length&&<div className="historyRow"><span>No venue benchmark yet</span><b>—</b><small>Rankings appear after best-price history accumulates.</small></div>}
   </div>
  </div>
  <div className="historyNote">V110 evaluates price capture, not win/loss outcomes. A positive benchmark means EdgeForce identified a price that later became less favorable, which is useful for execution-quality validation.</div>
 </section>;
}
