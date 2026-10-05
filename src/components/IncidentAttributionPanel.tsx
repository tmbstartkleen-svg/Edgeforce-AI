'use client';

import {useEffect,useState} from 'react';

type Payload={attribution:{primaryCause:string;confidence:number;severity:string;impactedComponents:string[];evidence:string[];remediation:string[];overall:string};recent:Array<{id:number;primaryCause:string;severity:string;confidence:number;observedAt:string}>};

export default function IncidentAttributionPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{const r=await fetch('/api/operations/incident-attribution',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};
  void load();const t=window.setInterval(()=>void load(),60000);return()=>{active=false;window.clearInterval(t)};
 },[]);
 const a=data?.attribution;
 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V75 INCIDENT ATTRIBUTION</div><h3>Root Cause & Remediation Guidance</h3></div>
   <div className="panelMeta"><span>{a?.severity||'LOADING'}</span><span>{a?Math.round(a.confidence*100)+'% confidence':'—'}</span></div>
  </div>
  <div className="v21Stats">
   <div><small>PRIMARY CAUSE</small><strong>{a?.primaryCause||'—'}</strong><span>{a?.overall||'—'} production state</span></div>
   <div><small>IMPACTED</small><strong>{a?.impactedComponents.length||0}</strong><span>components</span></div>
   <div><small>EVIDENCE</small><strong>{a?.evidence.length||0}</strong><span>supporting signals</span></div>
   <div><small>RECENT SNAPSHOTS</small><strong>{data?.recent.length||0}</strong><span>durable history</span></div>
  </div>
  <div className="historyGrid">
   <div className="historyBox"><h4>Evidence</h4>{(a?.evidence||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
   <div className="historyBox"><h4>Recommended remediation</h4>{(a?.remediation||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  </div>
  <div className="historyNote">V75 diagnoses production degradation and records evidence. It does not bypass SLO freezes, rollback gates, or recommendation safeguards.</div>
 </section>;
}
