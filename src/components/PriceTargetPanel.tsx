'use client';

import {useEffect,useMemo,useState} from 'react';

type Row={
 id:string;domain:'SPORTS'|'MARKETS';category:string;venue:string;title:string;
 currentValueState:'GREAT_PRICE'|'GOOD_PRICE'|'ACCEPTABLE'|'THIN_EDGE'|'NO_EDGE';
 currentEdgePoints:number;targetEdgePoints:number;valueScore:number;thresholdConfidence:number;
 display:{fair:string;great:string;good:string;acceptable:string;noEdge:string;current:string};
 reason:string;
};
type Payload={
 summary:{great:number;good:number;acceptable:number;thin:number;noEdge:number};
 rows:Row[];
};

export default function PriceTargetPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/price-targets',{cache:'no-store'});
    if(!res.ok)throw new Error('price target engine unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'price target engine unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),60000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const focus=useMemo(()=>[...(data?.rows||[])]
  .sort((a,b)=>b.valueScore-a.valueScore)
  .slice(0,14),[data]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V108 PRICE TARGETS</div>
    <h3>Fair Line, Good Price & Edge-Gone Thresholds</h3>
   </div>
   <div className="panelMeta">
    <span>Great {data?.summary.great||0}</span>
    <span>Good {data?.summary.good||0}</span>
    <span>No Edge {data?.summary.noEdge||0}</span>
   </div>
  </div>

  {error&&<div className="v21Alert">{error}</div>}

  <div className="historyGrid">
   <div className="historyBox">
    <h4>Best current value</h4>
    {focus.map(x=><div className="historyRow" key={x.id}>
     <span>{x.title}</span><b>{x.currentValueState}</b>
     <small>{x.domain} • {x.category} • {x.venue} • current {x.display.current} • fair {x.display.fair}</small>
     <small>great {x.display.great} • good {x.display.good} • acceptable {x.display.acceptable} • edge gone {x.display.noEdge}</small>
     <small>{x.reason}</small>
    </div>)}
    {!focus.length&&<div className="historyRow"><span>No active price targets</span><b>HOLD</b><small>No current Master Edge opportunity clears the value thresholds.</small></div>}
   </div>

   <div className="historyBox">
    <h4>Threshold summary</h4>
    <div className="historyRow"><span>Great Price</span><b>{data?.summary.great||0}</b><small>Material cushion versus the model-derived preferred threshold.</small></div>
    <div className="historyRow"><span>Good Price</span><b>{data?.summary.good||0}</b><small>Clears the preferred value threshold.</small></div>
    <div className="historyRow"><span>Acceptable</span><b>{data?.summary.acceptable||0}</b><small>Still enough modeled edge, but less room for error.</small></div>
    <div className="historyRow"><span>Thin / No Edge</span><b>{(data?.summary.thin||0)+(data?.summary.noEdge||0)}</b><small>Re-check or remove from priority as the market approaches fair value.</small></div>
   </div>
  </div>

  <div className="historyNote">Sports prices are shown as American-odds equivalents and prediction-market prices as cents/probability. These are model thresholds for monitoring, not guaranteed entry prices or outcomes.</div>
 </section>;
}
