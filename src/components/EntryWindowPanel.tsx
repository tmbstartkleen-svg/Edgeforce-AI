'use client';

import {useEffect,useMemo,useState} from 'react';

type Row={
 id:string;domain:'SPORTS'|'MARKETS';category:string;venue:string;title:string;
 edge:number;masterScore:number;timingState:'EARLY'|'WAIT'|'ENTRY_WINDOW'|'LATE'|'CLOSED';
 timingScore:number;timingConfidence:number;hoursRemaining:number|null;scoreVelocityPerHour:number;
 edgeVelocityPerHour:number;scoreVolatility:number;edgeVolatility:number;historyPoints:number;
 actionLabel:string;reason:string;
};
type Payload={
 summary:{early:number;wait:number;entryWindow:number;late:number;closed:number};
 rows:Row[];
};

const pct=(n:number)=>(n*100).toFixed(1)+'%';
const pts=(n:number)=>(n>=0?'+':'')+(n*100).toFixed(1)+' pts';
const hours=(n:number|null)=>n===null?'—':n<1?Math.max(0,n*60).toFixed(0)+'m':n.toFixed(1)+'h';

export default function EntryWindowPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/entry-window',{cache:'no-store'});
    if(!res.ok)throw new Error('entry window engine unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'entry window engine unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),60000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const focus=useMemo(()=>[...(data?.rows||[])]
  .filter(x=>x.timingState!=='CLOSED')
  .sort((a,b)=>{
   const rank={ENTRY_WINDOW:5,EARLY:4,WAIT:3,LATE:2,CLOSED:1};
   return rank[b.timingState]-rank[a.timingState]||b.timingScore-a.timingScore;
  }).slice(0,14),[data]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V107 OPPORTUNITY TIMING</div>
    <h3>Entry Window & Price Timing Monitor</h3>
   </div>
   <div className="panelMeta">
    <span>Window {data?.summary.entryWindow||0}</span>
    <span>Early {data?.summary.early||0}</span>
    <span>Late {data?.summary.late||0}</span>
   </div>
  </div>

  {error&&<div className="v21Alert">{error}</div>}

  <div className="historyGrid">
   <div className="historyBox">
    <h4>Timing priorities</h4>
    {focus.map(x=><div className="historyRow" key={x.id}>
     <span>{x.title}</span><b>{x.timingState}</b>
     <small>{x.domain} • {x.category} • {x.venue} • edge {pts(x.edge)} • {hours(x.hoursRemaining)} remaining</small>
     <small>timing {pct(x.timingScore)} • confidence {pct(x.timingConfidence)} • history {x.historyPoints} • {x.reason}</small>
    </div>)}
    {!focus.length&&<div className="historyRow"><span>No active timing candidates</span><b>HOLD</b><small>The timing engine will not force a window when current edge and history do not support one.</small></div>}
   </div>

   <div className="historyBox">
    <h4>Timing states</h4>
    <div className="historyRow"><span>Entry Window</span><b>{data?.summary.entryWindow||0}</b><small>High-priority re-check based on current edge, momentum, stability and time remaining.</small></div>
    <div className="historyRow"><span>Early</span><b>{data?.summary.early||0}</b><small>Still developing; monitor for confirmation or price improvement.</small></div>
    <div className="historyRow"><span>Wait</span><b>{data?.summary.wait||0}</b><small>Current movement is too weak or unstable to prioritize.</small></div>
    <div className="historyRow"><span>Late / Closed</span><b>{(data?.summary.late||0)+(data?.summary.closed||0)}</b><small>Little time remains or the edge has fallen below the timing floor.</small></div>
   </div>
  </div>

  <div className="historyNote">V107 is a monitoring layer. “Entry Window” means the opportunity deserves an immediate price/model re-check—not that placing a wager or trade at that moment is guaranteed to be favorable.</div>
 </section>;
}
