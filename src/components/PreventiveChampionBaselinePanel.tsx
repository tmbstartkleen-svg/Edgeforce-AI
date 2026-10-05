'use client';
import {useEffect,useState} from 'react';
type Payload={source:string;calibrationError:number;brierScore:number;sampleSize:number;promotedAt:string|null;rationale:string[]};
export default function PreventiveChampionBaselinePanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/operations/preventive-champion-baseline',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V87 CHAMPION BASELINE</div><h3>Validated Post-Probation Reference</h3></div><div className="panelMeta"><span>{data?.source||'LOADING'}</span><span>{data?.sampleSize||0} samples</span></div></div>
  <div className="v21Stats">
   <div><small>CALIBRATION ERROR</small><strong>{data?Math.round(data.calibrationError*100)+'%':'—'}</strong><span>champion baseline</span></div>
   <div><small>BRIER SCORE</small><strong>{data?data.brierScore.toFixed(3):'—'}</strong><span>champion baseline</span></div>
   <div><small>SAMPLES</small><strong>{data?.sampleSize||0}</strong><span>promotion evidence</span></div>
   <div><small>PROMOTED</small><strong>{data?.promotedAt?'YES':'NO'}</strong><span>validated full rollout</span></div>
  </div>
  <div className="historyBox"><h4>Promotion rationale</h4>{(data?.rationale||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  <div className="historyNote">V87 promotes a new baseline only after full staged rollout with stable performance and mature calibration evidence.</div>
 </section>;
}
