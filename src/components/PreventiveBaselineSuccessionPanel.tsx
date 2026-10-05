'use client';
import {useEffect,useState} from 'react';
type Payload={status:string;readinessScore:number;candidateCalibrationError:number;candidateBrierScore:number;candidateSampleSize:number;sourceWindows:number;rationale:string[]};
export default function PreventiveBaselineSuccessionPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/operations/preventive-baseline-succession',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V89 BASELINE SUCCESSION</div><h3>Replacement Candidate Readiness</h3></div><div className="panelMeta"><span>{data?.status||'LOADING'}</span><span>{data?Math.round(data.readinessScore*100)+'% ready':'—'}</span></div></div>
  <div className="v21Stats">
   <div><small>READINESS</small><strong>{data?Math.round(data.readinessScore*100)+'%':'—'}</strong><span>replacement baseline</span></div>
   <div><small>CAL ERROR</small><strong>{data?Math.round(data.candidateCalibrationError*100)+'%':'—'}</strong><span>candidate mean</span></div>
   <div><small>BRIER</small><strong>{data?data.candidateBrierScore.toFixed(3):'—'}</strong><span>candidate mean</span></div>
   <div><small>WINDOWS</small><strong>{data?.sourceWindows||0}</strong><span>recent evidence</span></div>
  </div>
  <div className="historyBox"><h4>Succession rationale</h4>{(data?.rationale||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  <div className="historyNote">V89 validates a replacement baseline after champion retirement using stable recent calibration windows before it can influence future probation comparisons.</div>
 </section>;
}
