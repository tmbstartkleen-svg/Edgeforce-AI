'use client';
import {useEffect,useState} from 'react';
type Payload={status:string;staleCyclesFound:number;staleCyclesRecovered:number;expiredLocksCleared:number;leaseLossCount:number;rationale:string[]};
export default function PreventiveBaselineGovernanceWatchdogPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/operations/preventive-baseline-governance-watchdog',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V95 GOVERNANCE WATCHDOG</div><h3>Heartbeat, Stale-Cycle Recovery & Lease Safety</h3></div><div className="panelMeta"><span>{data?.status||'LOADING'}</span><span>{data?.leaseLossCount||0} lease losses</span></div></div>
  <div className="v21Stats">
   <div><small>STALE FOUND</small><strong>{data?.staleCyclesFound||0}</strong><span>latest watchdog pass</span></div>
   <div><small>RECOVERED</small><strong>{data?.staleCyclesRecovered||0}</strong><span>cumulative stale cycles</span></div>
   <div><small>LOCKS CLEARED</small><strong>{data?.expiredLocksCleared||0}</strong><span>expired leases</span></div>
   <div><small>LEASE LOSSES</small><strong>{data?.leaseLossCount||0}</strong><span>mid-cycle protection</span></div>
  </div>
  <div className="historyBox"><h4>Watchdog rationale</h4>{(data?.rationale||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  <div className="historyNote">V95 recovers only stale execution state. It does not promote champions, change thresholds, or execute operational preventive actions.</div>
 </section>;
}
