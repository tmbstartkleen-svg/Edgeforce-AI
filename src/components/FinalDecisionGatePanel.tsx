'use client';

import {useEffect,useMemo,useState} from 'react';

type Row={
 id:string;domain:'SPORTS'|'MARKETS';category:string;venue:string;title:string;
 state:'PRIME'|'READY'|'WATCH'|'HOLD'|'REMOVE';
 actionabilityScore:number;modelScore:number;timingScore:number;priceScore:number;venueScore:number;
 executionFeedback:number;confidence:number;reasons:string[];
};
type Payload={summary:{prime:number;ready:number;watch:number;hold:number;remove:number};rows:Row[]};

const pct=(n:number)=>(n*100).toFixed(1)+'%';

export default function FinalDecisionGatePanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/final-decision-gate',{cache:'no-store'});
    if(!res.ok)throw new Error('final decision gate unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'final decision gate unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),60000);
  return()=>{active=false;window.clearInterval(timer)};
 },[]);
 const focus=useMemo(()=>[...(data?.rows||[])].slice(0,15),[data]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V112 FINAL DECISION GATE</div><h3>Composite Actionability & Priority Control</h3></div>
   <div className="panelMeta"><span>Prime {data?.summary.prime||0}</span><span>Ready {data?.summary.ready||0}</span><span>Hold {data?.summary.hold||0}</span></div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="historyGrid">
   <div className="historyBox">
    <h4>Final priority board</h4>
    {focus.map((x,i)=><div className="historyRow" key={x.id}>
     <span>#{i+1} · {x.title}</span><b>{x.state} · {pct(x.actionabilityScore)}</b>
     <small>{x.domain} • {x.category} • {x.venue} • confidence {pct(x.confidence)}</small>
     <small>model {pct(x.modelScore)} • timing {pct(x.timingScore)} • price {pct(x.priceScore)} • venue {pct(x.venueScore)}</small>
     <small>{x.reasons.length?x.reasons.join(' • '):'no special boost or penalty'}</small>
    </div>)}
    {!focus.length&&<div className="historyRow"><span>No current opportunities</span><b>HOLD</b><small>EdgeForce will not manufacture a final-priority candidate.</small></div>}
   </div>
   <div className="historyBox">
    <h4>Decision states</h4>
    <div className="historyRow"><span>PRIME</span><b>{data?.summary.prime||0}</b><small>Strong across model, timing, price and execution-quality layers.</small></div>
    <div className="historyRow"><span>READY</span><b>{data?.summary.ready||0}</b><small>High-priority opportunity with enough agreement to stay near the top of the board.</small></div>
    <div className="historyRow"><span>WATCH</span><b>{data?.summary.watch||0}</b><small>Promising, but at least one layer needs more confirmation.</small></div>
    <div className="historyRow"><span>HOLD / REMOVE</span><b>{(data?.summary.hold||0)+(data?.summary.remove||0)}</b><small>Insufficient composite support or a hard timing/price-quality penalty.</small></div>
   </div>
  </div>
  <div className="historyNote">V112 is the final analytics-priority gate only. PRIME and READY do not place wagers or trades; REMOVE only removes an opportunity from priority.</div>
 </section>;
}
