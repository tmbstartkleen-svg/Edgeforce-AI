'use client';

import {useEffect,useState} from 'react';

type Lane={
 id:string;domain:'SPORTS'|'MARKETS';dimension:string;key:string;sampleSize:number;evidence:string;
 rating:number;confidence:number;allocationWeight:number;maxWeight:number;state:string;reason:string;
};
type Payload={
 sportsWeight:number;marketsWeight:number;lanes:Lane[];
 safeguards:{minLeaderSamples:number;maxSingleLaneWeight:number;maxDomainWeight:number;insufficientWeightCap:number};
 notes:string[];
};

const pct=(n:number)=>(n*100).toFixed(1)+'%';

export default function DailyEdgeRouterPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/daily-edge-router',{cache:'no-store'});
    if(!res.ok)throw new Error('daily edge router unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'daily edge router unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),120000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V104 ADAPTIVE STRATEGY ALLOCATION</div>
    <h3>Daily Edge Router</h3>
   </div>
   <div className="panelMeta">
    <span>Sports {pct(data?.sportsWeight||0)}</span>
    <span>Markets {pct(data?.marketsWeight||0)}</span>
    <span>HOLD allowed</span>
   </div>
  </div>

  {error&&<div className="v21Alert">{error}</div>}

  <div className="historyGrid">
   <div className="historyBox">
    <h4>Highest-weight lanes</h4>
    {(data?.lanes||[]).slice(0,10).map(x=><div className="historyRow" key={x.id}>
     <span>{x.key}</span><b>{pct(x.allocationWeight)}</b>
     <small>{x.domain} • {x.dimension} • rating {x.rating.toFixed(1)} • n={x.sampleSize}</small>
     <small>{x.state} • {x.evidence} • confidence {pct(x.confidence)}</small>
    </div>)}
    {!data?.lanes?.length&&<div className="historyRow"><span>No validated lane has enough settled history</span><b>HOLD</b><small>EdgeForce will not manufacture a daily allocation when evidence is insufficient.</small></div>}
   </div>

   <div className="historyBox">
    <h4>Router guardrails</h4>
    <div className="historyRow"><span>Single lane maximum</span><b>{pct(data?.safeguards.maxSingleLaneWeight||0)}</b><small>Prevents one strategy or sport from dominating the daily model stack.</small></div>
    <div className="historyRow"><span>Domain maximum</span><b>{pct(data?.safeguards.maxDomainWeight||0)}</b><small>Caps Sports or Markets concentration.</small></div>
    <div className="historyRow"><span>Minimum leader sample</span><b>{data?.safeguards.minLeaderSamples||25}</b><small>Below this threshold, the router keeps the lane heavily constrained.</small></div>
    <div className="historyRow"><span>Insufficient-evidence cap</span><b>{pct(data?.safeguards.insufficientWeightCap||0)}</b><small>A short hot streak cannot receive meaningful daily weight.</small></div>
   </div>
  </div>

  <div className="historyNote">V104 changes analytical emphasis, not automatic wagering. It can route more simulation/attention toward historically stronger lanes and reduce weak ones, while leaving capital unallocated when the evidence does not justify activity.</div>
 </section>;
}
