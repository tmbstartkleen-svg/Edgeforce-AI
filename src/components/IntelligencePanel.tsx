'use client';
import {useEffect,useState} from 'react';

export default function IntelligencePanel(){
 const [clv,setClv]=useState<any>(null);
 const [providers,setProviders]=useState<any[]>([]);
 const [cells,setCells]=useState<any[]>([]);
 const [models,setModels]=useState<any[]>([]);
 const [profiles,setProfiles]=useState<any[]>([]);

 useEffect(()=>{
  Promise.all([
   fetch('/api/intelligence/clv',{cache:'no-store'}).then(r=>r.json()),
   fetch('/api/intelligence/provider-confidence',{cache:'no-store'}).then(r=>r.json()),
   fetch('/api/intelligence/calibration-map',{cache:'no-store'}).then(r=>r.json()),
   fetch('/api/intelligence/model-performance',{cache:'no-store'}).then(r=>r.json()),
   fetch('/api/intelligence/calibration-profile',{cache:'no-store'}).then(r=>r.json())
  ]).then(([c,p,m,mp,cp])=>{
   setClv(c);setProviders(p.providers||[]);setCells(m.cells||[]);setModels(mp.models||[]);setProfiles(cp.profiles||[]);
  }).catch(()=>{});
 },[]);

 const topProviders=[...providers].sort((a,b)=>Number(b.confidence?.score||0)-Number(a.confidence?.score||0)).slice(0,5);
 const avgError=cells.length?cells.reduce((s,c)=>s+Math.abs(Number(c.error||0)),0)/cells.length:0;
 const topModels=[...models].slice(0,6);
 const over=profiles.reduce((s,p)=>s+Number(p.overconfidentSamples||0),0);
 const under=profiles.reduce((s,p)=>s+Number(p.underconfidentSamples||0),0);

 return <section className="intelPanel">
  <div className="panelHead"><div><div className="eyebrow">V20 MODEL CALIBRATION INTELLIGENCE</div><h3>Rolling model rankings, calibration, CLV, and confidence decay</h3></div></div>
  <div className="intelStats">
   <div><small>CLV SAMPLE</small><strong>{clv?.summary?.sampleSize||0}</strong></div>
   <div><small>AVG CLV</small><strong className={Number(clv?.summary?.avgClv||0)>=0?'lime':'orange'}>{((Number(clv?.summary?.avgClv||0))*100).toFixed(2)+'%'}</strong></div>
   <div><small>CALIBRATION ERROR</small><strong>{(avgError*100).toFixed(2)+'%'}</strong></div>
   <div><small>OVER / UNDER</small><strong>{over+' / '+under}</strong></div>
  </div>
  <div className="intelGrid">
   <div className="consoleCard">
    <div className="eyebrow">ROLLING MODEL RANKINGS</div>
    {topModels.map((m:any)=><div className="healthRow" key={m.modelName+'|'+m.sport+'|'+m.marketKey}>
     <div><b>{m.modelName}</b><small>{m.sport+' • '+m.marketKey+' • n='+m.sampleSize+' • cal '+(Number(m.calibrationError||0)*100).toFixed(1)+'%'}</small></div>
     <span className={m.confidenceLabel==='HIGH'?'lime':m.confidenceLabel==='LOW'?'orange':''}>{m.confidenceLabel} {Math.round(Number(m.decayedScore||0)*100)}</span>
    </div>)}
    {!topModels.length&&<p className="emptyState">Rolling model rankings populate after settled historical predictions.</p>}
   </div>
   <div className="consoleCard">
    <div className="eyebrow">PROVIDER CONFIDENCE</div>
    {topProviders.map((p:any)=><div className="healthRow" key={p.id}>
     <div><b>{p.name}</b><small>{'Latency '+Number(p.latencyMs||0).toFixed(0)+'ms • Error '+(Number(p.errorRate||0)*100).toFixed(1)+'%'}</small></div>
     <span className={Number(p.confidence?.score||0)>=.72?'lime':'orange'}>{p.confidence?.grade||'—'} {p.confidence?Math.round(p.confidence.score*100):0}</span>
    </div>)}
    {!topProviders.length&&<p className="emptyState">Provider confidence populates when live provider history is available.</p>}
   </div>
  </div>
 </section>;
}
