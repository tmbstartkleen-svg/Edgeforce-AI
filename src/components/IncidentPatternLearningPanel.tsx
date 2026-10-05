'use client';

import {useEffect,useState} from 'react';

type Profile={cause:string;sampleSize:number;actionCount:number;recurrenceScore:number;trendScore:number;cofailureComponents:string[];recommendedRunbook:string[]};
type Payload={systemRisk:string;dominantCause:string;recurrenceScore:number;totalIncidents:number;profiles:Profile[]};

export default function IncidentPatternLearningPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{const r=await fetch('/api/operations/incident-patterns',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};
  void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)};
 },[]);
 const top=data?.profiles?.[0];
 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V76 INCIDENT PATTERN LEARNING</div><h3>Recurrence Risk, Co-Failures & Adaptive Runbooks</h3></div>
   <div className="panelMeta"><span>{data?.systemRisk||'LOADING'}</span><span>{data?Math.round(data.recurrenceScore*100)+'% recurrence':'—'}</span></div>
  </div>
  <div className="v21Stats">
   <div><small>DOMINANT CAUSE</small><strong>{data?.dominantCause||'—'}</strong><span>30-day learning window</span></div>
   <div><small>INCIDENTS</small><strong>{data?.totalIncidents||0}</strong><span>attribution samples</span></div>
   <div><small>ACTION REPEATS</small><strong>{top?.actionCount||0}</strong><span>{top?.sampleSize||0} dominant samples</span></div>
   <div><small>CO-FAILURES</small><strong>{top?.cofailureComponents.length||0}</strong><span>repeating components</span></div>
  </div>
  <div className="historyGrid">
   <div className="historyBox"><h4>Highest recurrence profiles</h4>
    {(data?.profiles||[]).slice(0,5).map(p=><div className="historyRow" key={p.cause}><span>{p.cause}</span><b>{Math.round(p.recurrenceScore*100)}%</b><small>{p.sampleSize} samples · trend {Math.round(p.trendScore*100)}%</small></div>)}
   </div>
   <div className="historyBox"><h4>Priority runbook</h4>
    {(top?.recommendedRunbook||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}
   </div>
  </div>
  <div className="historyNote">V76 learns recurring operational failure patterns from V75 evidence. It recommends runbooks but cannot reopen deployment freezes or override protective recommendation controls.</div>
 </section>;
}
