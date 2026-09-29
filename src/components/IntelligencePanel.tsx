'use client';
import {useEffect,useState} from 'react';

export default function IntelligencePanel(){
 const [clv,setClv]=useState<any>(null);
 const [providers,setProviders]=useState<any[]>([]);
 const [cells,setCells]=useState<any[]>([]);

 useEffect(()=>{
  Promise.all([
   fetch('/api/intelligence/clv',{cache:'no-store'}).then(r=>r.json()),
   fetch('/api/intelligence/provider-confidence',{cache:'no-store'}).then(r=>r.json()),
   fetch('/api/intelligence/calibration-map',{cache:'no-store'}).then(r=>r.json())
  ]).then(([c,p,m])=>{
   setClv(c);
   setProviders(p.providers||[]);
   setCells(m.cells||[]);
  }).catch(()=>{});
 },[]);

 const topProviders=[...providers].sort((a,b)=>Number(b.confidence?.score||0)-Number(a.confidence?.score||0)).slice(0,5);
 const avgError=cells.length?cells.reduce((s,c)=>s+Math.abs(Number(c.error||0)),0)/cells.length:0;

 return <section className="intelPanel">
  <div className="panelHead"><div><div className="eyebrow">V19 LIVE DATA INTELLIGENCE</div><h3>CLV, calibration, and provider confidence</h3></div></div>
  <div className="intelStats">
   <div><small>CLV SAMPLE</small><strong>{clv?.summary?.sampleSize||0}</strong></div>
   <div><small>AVG CLV</small><strong className={Number(clv?.summary?.avgClv||0)>=0?'lime':'orange'}>{((Number(clv?.summary?.avgClv||0))*100).toFixed(2)+'%'}</strong></div>
   <div><small>POSITIVE CLV</small><strong>{((Number(clv?.summary?.positiveRate||0))*100).toFixed(1)+'%'}</strong></div>
   <div><small>CALIBRATION ERROR</small><strong>{(avgError*100).toFixed(2)+'%'}</strong></div>
  </div>
  <div className="intelGrid">
   <div className="consoleCard">
    <div className="eyebrow">PROVIDER CONFIDENCE</div>
    {topProviders.map((p:any)=><div className="healthRow" key={p.id}>
     <div><b>{p.name}</b><small>{'Latency '+Number(p.latencyMs||0).toFixed(0)+'ms • Error '+(Number(p.errorRate||0)*100).toFixed(1)+'%'}</small></div>
     <span className={Number(p.confidence?.score||0)>=.72?'lime':'orange'}>{p.confidence?.grade||'—'} {p.confidence?Math.round(p.confidence.score*100):0}</span>
    </div>)}
    {!topProviders.length&&<p className="emptyState">Provider confidence populates when live provider history is available.</p>}
   </div>
   <div className="consoleCard">
    <div className="eyebrow">SPORT CLV</div>
    {(clv?.bySport||[]).slice(0,6).map((s:any)=><div className="healthRow" key={s.sport}>
     <div><b>{s.sport}</b><small>{'n='+s.sampleSize+' • positive '+(Number(s.positiveRate||0)*100).toFixed(1)+'%'}</small></div>
     <span className={Number(s.avgClv||0)>=0?'lime':'orange'}>{(Number(s.avgClv||0)*100).toFixed(2)+'%'}</span>
    </div>)}
    {!clv?.bySport?.length&&<p className="emptyState">Sport CLV populates after closing-line history is collected.</p>}
   </div>
  </div>
 </section>;
}
