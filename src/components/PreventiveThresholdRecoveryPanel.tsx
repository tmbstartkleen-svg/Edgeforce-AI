'use client';

import {useEffect,useState} from 'react';

type Payload={state:string;recoveryStreak:number;adaptiveReentryAllowed:boolean;rollbackReferenceId:number|null;rationale:string[]};

export default function PreventiveThresholdRecoveryPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{const r=await fetch('/api/operations/preventive-threshold-recovery',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};
  void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)};
 },[]);
 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V84 THRESHOLD RECOVERY</div><h3>Safe Re-entry After Adaptive Rollback</h3></div>
   <div className="panelMeta"><span>{data?.state||'LOADING'}</span><span>{data?.adaptiveReentryAllowed?'RE-ENTRY OPEN':'RE-ENTRY LOCKED'}</span></div>
  </div>
  <div className="v21Stats">
   <div><small>RECOVERY STREAK</small><strong>{data?.recoveryStreak||0}/3</strong><span>healthy supervision windows</span></div>
   <div><small>ADAPTIVE RE-ENTRY</small><strong>{data?.adaptiveReentryAllowed?'YES':'NO'}</strong><span>bounded threshold tuning</span></div>
   <div><small>ROLLBACK REFERENCE</small><strong>{data?.rollbackReferenceId||'—'}</strong><span>last known-safe set</span></div>
   <div><small>STATE</small><strong>{data?.state||'—'}</strong><span>OPEN / LOCKED / RECOVERING</span></div>
  </div>
  <div className="historyBox"><h4>Recovery rationale</h4>{(data?.rationale||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  <div className="historyNote">V84 requires three consecutive healthy recovery windows before adaptive threshold tuning can resume after rollback.</div>
 </section>;
}
