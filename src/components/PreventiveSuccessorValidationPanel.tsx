'use client';
import {useEffect,useState} from 'react';
type Payload={status:string;validationStreak:number;degradationScore:number;reverted:boolean;reversionCount:number;rationale:string[]};
export default function PreventiveSuccessorValidationPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/operations/preventive-successor-validation',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V91 SUCCESSOR VALIDATION</div><h3>Post-Handoff Proof & Safe Reversion</h3></div><div className="panelMeta"><span>{data?.status||'LOADING'}</span><span>{data?Math.round(data.degradationScore*100)+'% degradation':'—'}</span></div></div>
  <div className="v21Stats">
   <div><small>VALIDATION</small><strong>{data?.validationStreak||0}/3</strong><span>healthy windows</span></div>
   <div><small>DEGRADATION</small><strong>{data?Math.round(data.degradationScore*100)+'%':'—'}</strong><span>vs handoff baseline</span></div>
   <div><small>REVERSIONS</small><strong>{data?.reversionCount||0}</strong><span>failed handoffs</span></div>
   <div><small>LAST ACTION</small><strong>{data?.reverted?'REVERTED':'NONE'}</strong><span>safe fallback</span></div>
  </div>
  <div className="historyBox"><h4>Validation rationale</h4>{(data?.rationale||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  <div className="historyNote">V91 requires three healthy post-handoff windows to confirm a succession champion and revokes it on material degradation.</div>
 </section>;
}
