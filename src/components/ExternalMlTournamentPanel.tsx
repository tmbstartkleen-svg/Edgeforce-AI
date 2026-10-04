'use client';

import {useEffect,useState} from 'react';

type Champion={
 sport:string;marketKey:string;algorithm:string;serviceModelId:string;
 compositeScore:number;brierSkillScore:number;holdoutBrier:number;
 holdoutLogLoss:number;calibrationError:number;promotedAt:string;
};
type Candidate={
 sport:string;marketKey:string;algorithm:string;serviceModelId:string;
 role:string;sampleSize:number;holdoutSize:number;holdoutBrier:number;
 marketBaselineBrier:number;brierSkillScore:number;calibrationError:number;
 compositeScore:number;reason:string;featureImportance:Record<string,number>;
};
type Payload={
 ok:boolean;source:string;
 latestRun?:{
  id:number;serviceVersion?:string|null;status:string;rowsExported:number;
  groupsRequested:number;candidatesEvaluated:number;championsPromoted:number;
  challengersRetained:number;algorithms:string[];metrics?:Record<string,unknown>;
  startedAt:string;completedAt?:string|null;error?:string|null;
 }|null;
 champions:Champion[];
 candidates:Candidate[];
 summary:{champions:number;sports:number;candidates:number};
};

const pct=(n:number)=>(n*100).toFixed(1)+'%';
const signed=(n:number)=>(n>=0?'+':'')+(n*100).toFixed(1)+'%';

export default function ExternalMlTournamentPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/ml-tournament',{cache:'no-store'});
    if(!res.ok)throw new Error('external ML tournament status unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){
    if(active)setError(e instanceof Error?e.message:'external ML tournament status unavailable');
   }
  };
  void load();
  const timer=window.setInterval(()=>void load(),60000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const latest=data?.latestRun;
 const recent=data?.candidates||[];

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V58 EXTERNAL ML TOURNAMENT</div>
    <h3>XGBoost, LightGBM, CatBoost, Random Forest, stacking, and Bayesian challengers compete before promotion</h3>
   </div>
   <div className="panelMeta">
    <span>{data?.summary.champions??0} champions</span>
    <span>{data?.summary.sports??0} sports represented</span>
    <span>{latest?.serviceVersion||'service not run'}</span>
   </div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="v21Stats">
   <div><small>ROWS EXPORTED</small><strong>{latest?.rowsExported??0}</strong><span>settled leakage-safe training rows</span></div>
   <div><small>CANDIDATES</small><strong>{latest?.candidatesEvaluated??0}</strong><span>algorithm/group combinations evaluated</span></div>
   <div><small>NEW CHAMPIONS</small><strong>{latest?.championsPromoted??0}</strong><span>cleared incumbent + promotion margin</span></div>
   <div><small>CHALLENGERS RETAINED</small><strong>{latest?.challengersRetained??0}</strong><span>good models that did not clear promotion</span></div>
  </div>

  <div className="historyNote">Training does not directly change production. The external service returns a candidate winner; EdgeForce compares it with the incumbent champion and explicitly promotes only after market-relative holdout and promotion-margin gates pass.</div>

  <div className="v21PanelHead">
   <div><div className="eyebrow">PRODUCTION CHAMPIONS</div><h3>Current heavyweight ML winners</h3></div>
  </div>
  <div className="tableWrap">
   <table className="v21Table">
    <thead><tr><th>Sport</th><th>Market</th><th>Algorithm</th><th>Brier Skill</th><th>Holdout Brier</th><th>Log Loss</th><th>Calibration</th><th>Composite</th></tr></thead>
    <tbody>
     {(data?.champions||[]).map(x=><tr key={x.sport+'|'+x.marketKey}>
      <td><span className="sportPill">{x.sport}</span></td>
      <td>{x.marketKey}</td>
      <td><b>{x.algorithm}</b><small>{x.serviceModelId}</small></td>
      <td className={x.brierSkillScore>0?'lime':'negative'}>{signed(x.brierSkillScore)}</td>
      <td>{x.holdoutBrier.toFixed(3)}</td>
      <td>{x.holdoutLogLoss.toFixed(3)}</td>
      <td>{pct(x.calibrationError)}</td>
      <td>{x.compositeScore.toFixed(3)}</td>
     </tr>)}
     {!data?.champions?.length&&<tr><td colSpan={8} className="emptyRow">No external ML champion has been promoted yet. Configure the V55 Python service and run the tournament after enough settled history exists.</td></tr>}
    </tbody>
   </table>
  </div>

  <div className="v21PanelHead">
   <div><div className="eyebrow">LATEST CANDIDATES</div><h3>Champion / challenger decision trail</h3></div>
  </div>
  <div className="tableWrap">
   <table className="v21Table">
    <thead><tr><th>Role</th><th>Sport</th><th>Market</th><th>Algorithm</th><th>Samples</th><th>Brier Skill</th><th>Calibration</th><th>Decision</th></tr></thead>
    <tbody>
     {recent.slice(0,30).map((x,i)=><tr key={x.serviceModelId+'|'+i}>
      <td><span className="sportPill">{x.role}</span></td>
      <td>{x.sport}</td><td>{x.marketKey}</td><td><b>{x.algorithm}</b></td>
      <td>{x.sampleSize} / {x.holdoutSize} holdout</td>
      <td className={x.brierSkillScore>0?'lime':'negative'}>{signed(x.brierSkillScore)}</td>
      <td>{pct(x.calibrationError)}</td>
      <td><small>{x.reason}</small></td>
     </tr>)}
     {!recent.length&&<tr><td colSpan={8} className="emptyRow">No tournament candidates have been evaluated yet.</td></tr>}
    </tbody>
   </table>
  </div>

  <div className="historyNote">The external service requires persistent model storage. EdgeForce records tournament metrics and champion IDs, but the Python service must retain the corresponding serialized artifacts for live inference.</div>
 </section>;
}
