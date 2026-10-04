'use client';

import {useEffect,useState} from 'react';

type Artifact={
 id:number;sport:string;marketKey:string;algorithm:string;artifactVersion:string;
 sampleSize:number;trainSize:number;calibrationSize:number;holdoutSize:number;
 holdoutBrier:number;holdoutLogLoss:number;holdoutAccuracy:number;
 marketBaselineBrier:number;marketBaselineLogLoss:number;brierSkillScore:number;
 calibrationError:number;promoted:boolean;promotionReason:string;
 featureImportance:Record<string,number>;modelVersion:string;createdAt:string;
};
type Payload={
 ok:boolean;source:string;
 latestRun?:{
  id:number;modelVersion:string;status:string;rowsSeen:number;groupsEvaluated:number;
  artifactsTrained:number;artifactsPromoted:number;sports:string[];
  startedAt:string;completedAt?:string|null;error?:string|null;
 }|null;
 artifacts:Artifact[];
 summary:{promoted:number;held:number;sports:number;averageBrierSkill:number};
};

const pct=(n:number)=>(n*100).toFixed(1)+'%';
const signed=(n:number)=>(n>=0?'+':'')+(n*100).toFixed(1)+'%';

export default function TrainedSportModelsPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/trained-models',{cache:'no-store'});
    if(!res.ok)throw new Error('trained sport model status unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){
    if(active)setError(e instanceof Error?e.message:'trained sport model status unavailable');
   }
  };
  void load();
  const timer=window.setInterval(()=>void load(),60000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const promoted=(data?.artifacts||[]).filter(x=>x.promoted);
 const held=(data?.artifacts||[]).filter(x=>!x.promoted);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V54 TRAINED SPORT-SPECIFIC ML</div>
    <h3>Models trained on settled EdgeForce history and promoted only after chronological holdout validation</h3>
   </div>
   <div className="panelMeta">
    <span>{data?.summary.promoted??0} promoted</span>
    <span>{data?.summary.held??0} held</span>
    <span>{data?.summary.sports??0} sports trained</span>
   </div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="v21Stats">
   <div><small>LATEST TRAINING ROWS</small><strong>{data?.latestRun?.rowsSeen??0}</strong><span>settled Model Council observations</span></div>
   <div><small>ARTIFACTS TRAINED</small><strong>{data?.latestRun?.artifactsTrained??0}</strong><span>sport-wide + market-specific candidates</span></div>
   <div><small>PROMOTED</small><strong>{data?.summary.promoted??0}</strong><span>cleared market-baseline holdout gates</span></div>
   <div><small>AVG BRIER SKILL</small><strong>{data?signed(data.summary.averageBrierSkill):'—'}</strong><span>versus sportsbook implied probability</span></div>
  </div>
  <div className="historyNote">Training is chronological: 70% train, 15% calibration, 15% untouched holdout. A model is held unless it has enough settled samples, positive Brier skill versus the market, acceptable log loss, and acceptable calibration error.</div>
  <div className="tableWrap">
   <table className="v21Table">
    <thead><tr><th>Status</th><th>Sport</th><th>Market</th><th>Samples</th><th>Holdout</th><th>Model Brier</th><th>Market Brier</th><th>Brier Skill</th><th>Calibration</th><th>Top learned features</th></tr></thead>
    <tbody>
     {[...promoted,...held].slice(0,30).map(x=>{
      const top=Object.entries(x.featureImportance||{}).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,4).map(([k])=>k).join(' • ');
      return <tr key={x.id}>
       <td><span className="sportPill">{x.promoted?'PROMOTED':'HELD'}</span></td>
       <td><b>{x.sport}</b></td>
       <td>{x.marketKey}</td>
       <td>{x.sampleSize}</td>
       <td>{x.holdoutSize}</td>
       <td>{x.holdoutBrier.toFixed(3)}</td>
       <td>{x.marketBaselineBrier.toFixed(3)}</td>
       <td className={x.brierSkillScore>0?'lime':'negative'}>{signed(x.brierSkillScore)}</td>
       <td>{pct(x.calibrationError)}</td>
       <td><small>{top||'—'}</small></td>
      </tr>
     })}
     {!data?.artifacts?.length&&<tr><td colSpan={10} className="emptyRow">No trained artifacts yet. V54 will train automatically during the daily recalibration run once enough settled history exists.</td></tr>}
    </tbody>
   </table>
  </div>
  <div className="historyNote">A promoted model becomes the <b>Trained Sport ML</b> expert vote for matching live markets. Held models remain visible for diagnostics but cannot influence production recommendations.</div>
 </section>;
}
