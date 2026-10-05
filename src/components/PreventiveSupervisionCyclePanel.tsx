'use client';
import {useEffect,useState} from 'react';
type Payload={status:string;cycleKey:string|null;reusedContextCount:number;stepCount:number;rationale?:string[];recent:Array<{status:string}>};
export default function PreventiveSupervisionCyclePanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/operations/preventive-supervision-cycle',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V96 SUPERVISION CYCLE</div><h3>Unified Evidence Context & Deduplicated Decisions</h3></div><div className="panelMeta"><span>{data?.status||'LOADING'}</span><span>{data?.reusedContextCount||0} reused contexts</span></div></div>
  <div className="v21Stats">
   <div><small>CYCLE</small><strong>{data?.cycleKey?'ACTIVE':'—'}</strong><span>minute-bucket execution</span></div>
   <div><small>STEPS</small><strong>{data?.stepCount||0}</strong><span>coordinated stages</span></div>
   <div><small>REUSED</small><strong>{data?.reusedContextCount||0}</strong><span>duplicate rebuilds avoided</span></div>
   <div><small>RECENT</small><strong>{data?.recent?.length||0}</strong><span>cycle snapshots</span></div>
  </div>
  <div className="historyNote">V96 reuses pattern, observability, risk, learning, calibration, ranking, and effective-threshold evidence across downstream decisions instead of rebuilding the same context repeatedly.</div>
 </section>;
}
