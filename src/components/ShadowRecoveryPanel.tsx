'use client';

import {useEffect,useState} from 'react';

type Challenger={
 id:number;sport:string;marketKey:string;algorithm:string;serviceModelId:string;status:string;
 holdoutBrier:number;holdoutBrierSkillScore:number;settledSampleSize:number;liveBrier?:number|null;
 liveLogLoss?:number|null;liveCalibrationError?:number|null;marketBrier?:number|null;nativeBrier?:number|null;
 marketBrierSkillScore?:number|null;nativeBrierSkillScore?:number|null;brierDegradation?:number|null;
 confirmations:number;recoveryEligible:boolean;decisionReason?:string|null;startedAt:string;
 lastPredictionAt?:string|null;lastEvaluatedAt?:string|null;completedAt?:string|null;
};
type Snapshot={
 challengerId:number;sport:string;marketKey:string;algorithm:string;serviceModelId:string;state:string;
 sampleSize:number;liveBrier:number;liveCalibrationError:number;marketBrierSkillScore:number;
 nativeBrierSkillScore:number;brierDegradation:number;priorConfirmations:number;action:string;
 reason:string;observedAt:string;
};
type Payload={
 ok:boolean;build:string;schemaVersion:string;
 latestRun?:{status:string;challengersChecked:number;insufficient:number;shadow:number;readyConfirm:number;
 recovered:number;rejected:number;promotionFailed:number;startedAt:string;completedAt?:string|null;error?:string|null}|null;
 challengers:Challenger[];recent:Snapshot[];
};

const pct=(n?:number|null)=>Number.isFinite(Number(n))?(Number(n)*100).toFixed(1)+'%':'—';
const num=(n?:number|null)=>Number.isFinite(Number(n))?Number(n).toFixed(3):'—';

export default function ShadowRecoveryPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/ml-shadow-recovery',{cache:'no-store'});
    if(!res.ok)throw new Error('shadow recovery status unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'shadow recovery status unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),30000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const latest=data?.latestRun;
 const active=(data?.challengers||[]).filter(x=>x.status==='SHADOW'||x.status==='READY_CONFIRM');

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V60 SHADOW CHALLENGER + LIVE RECOVERY</div>
    <h3>Zero-weight external challengers must prove live skill before returning to production</h3>
   </div>
   <div className="panelMeta">
    <span>{active.length} shadow</span>
    <span>{latest?.readyConfirm??0} confirm</span>
    <span>{latest?.recovered??0} recovered</span>
   </div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}

  <div className="v21Stats">
   <div><small>SHADOW MODE</small><strong>{latest?.shadow??0}</strong><span>production voting weight remains 0</span></div>
   <div><small>INSUFFICIENT</small><strong>{latest?.insufficient??0}</strong><span>default minimum is 50 settled predictions</span></div>
   <div><small>READY CONFIRM</small><strong>{latest?.readyConfirm??0}</strong><span>needs another passing run with new evidence</span></div>
   <div><small>RECOVERED</small><strong>{latest?.recovered??0}</strong><span>artifact-verified promotion back to production</span></div>
  </div>

  <div className="historyNote">Shadow predictions are stored in a separate V60 table and never enter sportFeatures, Expert Suite, Model Council, simulations, parlays, or stake sizing. Recovery compares the challenger against both sportsbook pricing and a native-only EdgeForce Council baseline.</div>

  <div className="tableWrap">
   <table className="v21Table">
    <thead><tr><th>Status</th><th>Sport</th><th>Market</th><th>Algorithm</th><th>Settled</th><th>Market Skill</th><th>Native Skill</th><th>Calibration</th><th>Confirmations</th></tr></thead>
    <tbody>
     {(data?.challengers||[]).slice(0,40).map(row=><tr key={row.id}>
      <td><span className="sportPill">{row.status}</span></td>
      <td>{row.sport}</td><td>{row.marketKey}</td>
      <td><b>{row.algorithm}</b><small>{row.serviceModelId}</small></td>
      <td>{row.settledSampleSize}</td>
      <td className={(row.marketBrierSkillScore??0)>0?'lime':'negative'}>{pct(row.marketBrierSkillScore)}</td>
      <td className={(row.nativeBrierSkillScore??0)>0?'lime':'negative'}>{pct(row.nativeBrierSkillScore)}</td>
      <td>{pct(row.liveCalibrationError)}</td>
      <td>{row.confirmations}</td>
     </tr>)}
     {!data?.challengers?.length&&<tr><td colSpan={9} className="emptyRow">No shadow challenger exists yet. V60 creates one only after an external champion has been quarantined and a later tournament finds an eligible replacement candidate.</td></tr>}
    </tbody>
   </table>
  </div>

  <div className="v21PanelHead"><div><div className="eyebrow">RECOVERY EVIDENCE</div><h3>Fresh live decisions</h3></div></div>
  <div className="tableWrap">
   <table className="v21Table">
    <thead><tr><th>State</th><th>Sport</th><th>Market</th><th>N</th><th>Market Skill</th><th>Native Skill</th><th>Brier Δ</th><th>Action</th><th>Reason</th></tr></thead>
    <tbody>
     {(data?.recent||[]).slice(0,50).map((row,i)=><tr key={row.challengerId+'|'+row.observedAt+'|'+i}>
      <td><span className="sportPill">{row.state}</span></td><td>{row.sport}</td><td>{row.marketKey}</td><td>{row.sampleSize}</td>
      <td className={row.marketBrierSkillScore>0?'lime':'negative'}>{pct(row.marketBrierSkillScore)}</td>
      <td className={row.nativeBrierSkillScore>0?'lime':'negative'}>{pct(row.nativeBrierSkillScore)}</td>
      <td>{num(row.brierDegradation)}</td><td><b>{row.action}</b><small>{row.priorConfirmations} prior</small></td>
      <td><small>{row.reason}</small></td>
     </tr>)}
     {!data?.recent?.length&&<tr><td colSpan={9} className="emptyRow">No live shadow recovery evaluation has run yet.</td></tr>}
    </tbody>
   </table>
  </div>
 </section>;
}
