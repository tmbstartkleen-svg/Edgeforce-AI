'use client';

import {useEffect,useMemo,useState} from 'react';

type Row={
 id:string;type:string;severity:'CRITICAL'|'HIGH'|'MEDIUM'|'LOW';domain:'SPORTS'|'MARKETS';
 category:string;title:string;action:string;score:number;expiresAt?:string;cooldownMinutes:number;reasons:string[];
};
type Payload={summary:{critical:number;high:number;medium:number;low:number};rows:Row[]};

const pct=(n:number)=>(n*100).toFixed(1)+'%';

export default function OpportunityCommandQueuePanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/command-queue',{cache:'no-store'});
    if(!res.ok)throw new Error('command queue unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'command queue unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),60000);
  return()=>{active=false;window.clearInterval(timer)};
 },[]);
 const focus=useMemo(()=>[...(data?.rows||[])].slice(0,20),[data]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V113 UNIFIED COMMAND QUEUE</div><h3>Prioritized Opportunity & Cash-Out Review Queue</h3></div>
   <div className="panelMeta"><span>Critical {data?.summary.critical||0}</span><span>High {data?.summary.high||0}</span><span>Medium {data?.summary.medium||0}</span></div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="historyGrid">
   <div className="historyBox">
    <h4>Current command queue</h4>
    {focus.map((x,i)=><div className="historyRow" key={x.id}>
     <span>#{i+1} · {x.title}</span><b>{x.severity}</b>
     <small>{x.domain} • {x.category} • {x.type} • priority {pct(x.score)}</small>
     <small>{x.action}</small>
     <small>cooldown {x.cooldownMinutes}m{x.expiresAt?' • expires '+new Date(x.expiresAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):''}</small>
    </div>)}
    {!focus.length&&<div className="historyRow"><span>No active commands</span><b>CLEAR</b><small>Nothing currently requires a high-priority analytical re-check.</small></div>}
   </div>
   <div className="historyBox">
    <h4>Queue policy</h4>
    <div className="historyRow"><span>Critical</span><b>{data?.summary.critical||0}</b><small>Final-leg cash-out review or equivalent highest-priority checkpoint.</small></div>
    <div className="historyRow"><span>High</span><b>{data?.summary.high||0}</b><small>PRIME opportunity or edge exit requiring immediate re-check/removal.</small></div>
    <div className="historyRow"><span>Medium</span><b>{data?.summary.medium||0}</b><small>READY, weakening, or standard cash-out review checkpoint.</small></div>
    <div className="historyRow"><span>Low</span><b>{data?.summary.low||0}</b><small>Informational only.</small></div>
   </div>
  </div>
  <div className="historyNote">V113 deduplicates and prioritizes analytical follow-up. It never places a wager, submits a trade, accepts a cash-out offer, or closes a position automatically.</div>
 </section>;
}
