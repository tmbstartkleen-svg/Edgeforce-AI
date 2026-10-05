'use client';
import {useEffect,useState} from 'react';
type Payload={status:string;driftScore:number;ageDays:number;retired:boolean;retirementCount:number;rationale:string[]};
export default function PreventiveChampionBaselineHealthPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/operations/preventive-champion-baseline-health',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V88 CHAMPION BASELINE HEALTH</div><h3>Drift, Staleness & Retirement</h3></div><div className="panelMeta"><span>{data?.status||'LOADING'}</span><span>{data?Math.round(data.driftScore*100)+'% drift':'—'}</span></div></div>
  <div className="v21Stats">
   <div><small>DRIFT</small><strong>{data?Math.round(data.driftScore*100)+'%':'—'}</strong><span>vs current calibration</span></div>
   <div><small>AGE</small><strong>{data?Math.round(data.ageDays)+'d':'—'}</strong><span>since promotion</span></div>
   <div><small>RETIREMENTS</small><strong>{data?.retirementCount||0}</strong><span>champion demotions</span></div>
   <div><small>LAST ACTION</small><strong>{data?.retired?'RETIRED':'NONE'}</strong><span>baseline protection</span></div>
  </div>
  <div className="historyBox"><h4>Baseline-health rationale</h4>{(data?.rationale||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  <div className="historyNote">V88 retires a champion baseline when it becomes stale or materially misaligned with current healthy calibration.</div>
 </section>;
}
