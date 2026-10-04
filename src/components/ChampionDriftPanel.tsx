'use client';

import {useEffect,useState} from 'react';

type Champion={
 sport:string;marketKey:string;algorithm:string;serviceModelId:string;
 active:boolean;status:string;promotedAt?:string|null;quarantinedAt?:string|null;
 quarantineReason?:string|null;lastMonitorAt?:string|null;liveSampleSize:number;
 liveBrier?:number|null;liveLogLoss?:number|null;liveCalibrationError?:number|null;
 liveBrierSkillScore?:number|null;liveDriftScore?:number|null;holdoutBrier:number;
 trainingBrierSkillScore:number;
};
type Snapshot={
 sport:string;marketKey:string;algorithm:string;serviceModelId:string;state:string;
 sampleSize:number;recentWindow:number;liveBrier:number;liveLogLoss:number;
 liveCalibrationError:number;liveBrierSkillScore:number;marketBrier:number;
 trainingHoldoutBrier:number;brierDegradation:number;driftScore:number;
 priorCriticalRuns:number;action:string;reason:string;observedAt:string;
};
type Payload={
 ok:boolean;build:string;schemaVersion:string;
 latestRun?:{
  id:number;status:string;championsChecked:number;healthy:number;watch:number;
  critical:number;quarantined:number;insufficient:number;startedAt:string;
  completedAt?:string|null;error?:string|null;
 }|null;
 champions:Champion[];
 recent:Snapshot[];
};

const pct=(n?:number|null)=>Number.isFinite(Number(n))?(Number(n)*100).toFixed(1)+'%':'—';
const num=(n?:number|null)=>Number.isFinite(Number(n))?Number(n).toFixed(3):'—';
const when=(v?:string|null)=>{
 if(!v)return '—';
 const d=new Date(v);
 return Number.isNaN(d.getTime())?'—':d.toLocaleString();
};

export default function ChampionDriftPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/ml-drift',{cache:'no-store'});
    if(!res.ok)throw new Error('champion drift status unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){
    if(active)setError(e instanceof Error?e.message:'champion drift status unavailable');
   }
  };
  void load();
  const timer=window.setInterval(()=>void load(),30000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const latest=data?.latestRun;
 const champions=data?.champions||[];
 const recent=data?.recent||[];

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V59 CHAMPION DRIFT + AUTO-ROLLBACK</div>
    <h3>Settled live performance, market-relative decay, quarantine, and native-model fallback</h3>
   </div>
   <div className="panelMeta">
    <span>{champions.filter(x=>x.active).length} active</span>
    <span>{champions.filter(x=>!x.active).length} quarantined</span>
    <span>{latest?.status?.toUpperCase()||'NOT RUN'}</span>
   </div>
  </div>

  {error&&<div className="v21Alert">{error}</div>}

  <div className="v21Stats">
   <div><small>HEALTHY</small><strong>{latest?.healthy??0}</strong><span>inside live drift guardrails</span></div>
   <div><small>WATCH</small><strong>{latest?.watch??0}</strong><span>weakening but still serving</span></div>
   <div><small>CRITICAL</small><strong>{latest?.critical??0}</strong><span>requires confirmation with new settled evidence</span></div>
   <div><small>QUARANTINED</small><strong>{latest?.quarantined??0}</strong><span>external manifest retired; native fallback active</span></div>
  </div>

  <div className="historyNote">V59 does not quarantine a champion because of one bad stretch or repeated checks on unchanged data. A champion needs enough settled predictions and two critical evaluations with new settled evidence before automatic retirement.</div>

  <div className="v21PanelHead">
   <div><div className="eyebrow">PRODUCTION CHAMPIONS</div><h3>Live evidence versus original holdout evidence</h3></div>
  </div>
  <div className="tableWrap">
   <table className="v21Table">
    <thead><tr><th>Status</th><th>Sport</th><th>Market</th><th>Algorithm</th><th>Live N</th><th>Live Brier</th><th>Brier Skill</th><th>Calibration</th><th>Drift</th></tr></thead>
    <tbody>
     {champions.map(row=><tr key={row.sport+'|'+row.marketKey}>
      <td><span className="sportPill">{row.status}</span></td>
      <td>{row.sport}</td><td>{row.marketKey}</td>
      <td><b>{row.algorithm}</b><small>{row.serviceModelId}</small></td>
      <td>{row.liveSampleSize??0}</td>
      <td>{num(row.liveBrier)}<small>train {num(row.holdoutBrier)}</small></td>
      <td className={(row.liveBrierSkillScore??0)>0?'lime':'negative'}>{pct(row.liveBrierSkillScore)}<small>train {pct(row.trainingBrierSkillScore)}</small></td>
      <td>{pct(row.liveCalibrationError)}</td>
      <td>{num(row.liveDriftScore)}</td>
     </tr>)}
     {!champions.length&&<tr><td colSpan={9} className="emptyRow">No external ML champions exist yet. Drift monitoring begins after the first hosted champion tournament.</td></tr>}
    </tbody>
   </table>
  </div>

  <div className="v21PanelHead">
   <div><div className="eyebrow">RECENT DRIFT DECISIONS</div><h3>Evidence trail for health, watch, critical, and quarantine states</h3></div>
  </div>
  <div className="tableWrap">
   <table className="v21Table">
    <thead><tr><th>State</th><th>Sport</th><th>Market</th><th>Samples</th><th>Skill</th><th>Brier Δ</th><th>Calibration</th><th>Action</th><th>Reason</th></tr></thead>
    <tbody>
     {recent.slice(0,50).map((row,i)=><tr key={row.serviceModelId+'|'+row.observedAt+'|'+i}>
      <td><span className="sportPill">{row.state}</span></td>
      <td>{row.sport}</td><td>{row.marketKey}</td><td>{row.sampleSize}</td>
      <td className={row.liveBrierSkillScore>0?'lime':'negative'}>{pct(row.liveBrierSkillScore)}</td>
      <td>{num(row.brierDegradation)}</td><td>{pct(row.liveCalibrationError)}</td>
      <td><b>{row.action}</b><small>{row.priorCriticalRuns} prior critical</small></td>
      <td><small>{row.reason}</small></td>
     </tr>)}
     {!recent.length&&<tr><td colSpan={9} className="emptyRow">No champion drift evaluation has run yet.</td></tr>}
    </tbody>
   </table>
  </div>

  <div className="historyGrid">
   <div className="historyBox">
    <h4>Fail-closed rollback</h4>
    <div className="historyRow"><span>Service retirement</span><b>FIRST</b><small>exact hosted champion manifest must retire successfully</small></div>
    <div className="historyRow"><span>Database quarantine</span><b>SECOND</b><small>only marked inactive after hosted retirement succeeds</small></div>
    <div className="historyRow"><span>Fallback</span><b>NATIVE</b><small>EdgeForce continues without the degraded external expert</small></div>
   </div>
   <div className="historyBox">
    <h4>Latest monitor</h4>
    <div className="historyRow"><span>Checked</span><b>{latest?.championsChecked??0}</b><small>{when(latest?.completedAt||latest?.startedAt)}</small></div>
    <div className="historyRow"><span>Insufficient</span><b>{latest?.insufficient??0}</b><small>held until minimum settled sample exists</small></div>
    <div className="historyRow"><span>Error</span><b>{latest?.error?'YES':'NO'}</b><small>{latest?.error||'no monitor error recorded'}</small></div>
   </div>
  </div>
 </section>;
}
