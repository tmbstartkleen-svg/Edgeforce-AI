'use client';

import {useEffect,useState} from 'react';

type Profile={cause:string;actionKey:string;sampleSize:number;preventedCount:number;incidentCount:number;effectivenessScore:number;confidence:number};
type Payload={profiles:Profile[];evaluatedEvents:number;recent:Array<{id:number;cause:string;actionText:string;outcome:string|null;appliedAt:string}>};

export default function PreventiveActionLearningPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{const r=await fetch('/api/operations/preventive-actions',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};
  void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)};
 },[]);
 const best=data?.profiles?.[0];
 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V78 PREVENTIVE ACTION LEARNING</div><h3>Safeguard Effectiveness & Outcome Feedback</h3></div>
   <div className="panelMeta"><span>{best?Math.round(best.effectivenessScore*100)+'% best':'LEARNING'}</span><span>{data?.evaluatedEvents||0} evaluated</span></div>
  </div>
  <div className="v21Stats">
   <div><small>BEST CAUSE</small><strong>{best?.cause||'—'}</strong><span>highest learned effectiveness</span></div>
   <div><small>SAMPLES</small><strong>{best?.sampleSize||0}</strong><span>for best action</span></div>
   <div><small>NO-INCIDENT WINDOWS</small><strong>{best?.preventedCount||0}</strong><span>{best?.incidentCount||0} matching incidents</span></div>
   <div><small>CONFIDENCE</small><strong>{best?Math.round(best.confidence*100)+'%':'—'}</strong><span>evidence maturity</span></div>
  </div>
  <div className="historyGrid">
   <div className="historyBox"><h4>Top learned safeguards</h4>
    {(data?.profiles||[]).slice(0,6).map(p=><div className="historyRow" key={p.cause+p.actionKey}><span>{p.cause}</span><b>{Math.round(p.effectivenessScore*100)}%</b><small>{p.sampleSize} samples · {p.preventedCount} no-incident windows</small></div>)}
   </div>
   <div className="historyBox"><h4>Recent action outcomes</h4>
    {(data?.recent||[]).slice(0,6).map(x=><div className="historyRow" key={x.id}><span>{x.cause}</span><b>{x.outcome||'PENDING'}</b><small>{x.actionText}</small></div>)}
   </div>
  </div>
  <div className="historyNote">V78 records operator-applied preventive actions and evaluates whether the same-cause ACTION incident appears within 24 hours. It does not apply changes automatically.</div>
 </section>;
}
