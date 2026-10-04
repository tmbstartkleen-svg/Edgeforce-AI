'use client';

import {useEffect,useState} from 'react';

type League={
 id:number;sport:string;marketKey:string;status:string;maxChallengers:number;minCompetitors:number;
 winnerChallengerId?:number|null;winnerServiceModelId?:string|null;winnerMargin?:number|null;
 decisionReason?:string|null;startedAt:string;completedAt?:string|null;
};
type Challenger={
 id:number;leagueId?:number|null;seedRank?:number|null;leagueRank?:number|null;leagueScore?:number|null;winnerMargin?:number|null;
 sport:string;marketKey:string;algorithm:string;serviceModelId:string;status:string;
 holdoutBrier:number;holdoutBrierSkillScore:number;settledSampleSize:number;liveBrier?:number|null;
 liveLogLoss?:number|null;liveCalibrationError?:number|null;marketBrier?:number|null;nativeBrier?:number|null;
 marketBrierSkillScore?:number|null;nativeBrierSkillScore?:number|null;brierDegradation?:number|null;
 confirmations:number;recoveryEligible:boolean;decisionReason?:string|null;startedAt:string;
 lastPredictionAt?:string|null;lastEvaluatedAt?:string|null;completedAt?:string|null;
};
type Snapshot={
 challengerId:number;leagueId?:number|null;leagueRank?:number|null;leagueScore?:number|null;winnerMargin?:number|null;
 sport:string;marketKey:string;algorithm:string;serviceModelId:string;state:string;
 sampleSize:number;liveBrier:number;liveCalibrationError:number;marketBrierSkillScore:number;
 nativeBrierSkillScore:number;brierDegradation:number;priorConfirmations:number;action:string;
 reason:string;observedAt:string;
};
type Payload={
 ok:boolean;build:string;schemaVersion:string;
 latestRun?:{status:string;challengersChecked:number;leaguesChecked?:number;leagueWinnersReady?:number;insufficient:number;shadow:number;readyConfirm:number;
 recovered:number;rejected:number;promotionFailed:number;startedAt:string;completedAt?:string|null;error?:string|null}|null;
 leagues:League[];challengers:Challenger[];recent:Snapshot[];
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
 const leagues=data?.leagues||[];
 const activeLeagues=leagues.filter(x=>x.status==='ACTIVE');
 const active=(data?.challengers||[]).filter(x=>x.status==='SHADOW'||x.status==='READY_CONFIRM');

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V61 MULTI-CHALLENGER SHADOW LEAGUE</div>
    <h3>Multiple zero-weight challengers compete live; only the proven league winner can return to production</h3>
   </div>
   <div className="panelMeta">
    <span>{activeLeagues.length} leagues</span>
    <span>{active.length} competitors</span>
    <span>{latest?.recovered??0} recovered</span>
   </div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}

  <div className="v21Stats">
   <div><small>ACTIVE LEAGUES</small><strong>{activeLeagues.length}</strong><span>quarantined sport/market recovery competitions</span></div>
   <div><small>COMPETITORS</small><strong>{active.length}</strong><span>production voting weight remains 0</span></div>
   <div><small>LEADERS READY</small><strong>{latest?.readyConfirm??0}</strong><span>must retain #1 on fresh evidence</span></div>
   <div><small>RECOVERED</small><strong>{latest?.recovered??0}</strong><span>live league winner promoted after artifact verification</span></div>
  </div>

  <div className="historyNote">V61 can run several qualified XGBoost, LightGBM, CatBoost, Random Forest, stacking, Bayesian, or other tournament candidates on the same settled slate. Every competitor remains zero-weight until the live league winner clears market/native recovery gates, fresh confirmation, winner-margin, cooldown, and hosted artifact checks.</div>

  <div className="tableWrap">
   <table className="v21Table">
    <thead><tr><th>Status</th><th>League</th><th>Rank</th><th>Sport</th><th>Market</th><th>Algorithm</th><th>Settled</th><th>League Score</th><th>Market Skill</th><th>Native Skill</th><th>Confirmations</th></tr></thead>
    <tbody>
     {(data?.challengers||[]).slice(0,40).map(row=><tr key={row.id}>
      <td><span className="sportPill">{row.status}</span></td>
      <td>{row.leagueId??'—'}<small>seed {row.seedRank??'—'}</small></td>
      <td><b>{row.leagueRank??'—'}</b><small>margin {num(row.winnerMargin)}</small></td>
      <td>{row.sport}</td><td>{row.marketKey}</td>
      <td><b>{row.algorithm}</b><small>{row.serviceModelId}</small></td>
      <td>{row.settledSampleSize}</td>
      <td>{num(row.leagueScore)}</td>
      <td className={(row.marketBrierSkillScore??0)>0?'lime':'negative'}>{pct(row.marketBrierSkillScore)}</td>
      <td className={(row.nativeBrierSkillScore??0)>0?'lime':'negative'}>{pct(row.nativeBrierSkillScore)}</td>
      <td>{row.confirmations}</td>
     </tr>)}
     {!data?.challengers?.length&&<tr><td colSpan={11} className="emptyRow">No shadow league exists yet. V61 creates one after an external champion is quarantined and a later tournament produces qualified replacement candidates.</td></tr>}
    </tbody>
   </table>
  </div>

  <div className="v21PanelHead"><div><div className="eyebrow">RECOVERY EVIDENCE</div><h3>Fresh live decisions</h3></div></div>
  <div className="tableWrap">
   <table className="v21Table">
    <thead><tr><th>State</th><th>League</th><th>Rank</th><th>Sport</th><th>Market</th><th>N</th><th>Score</th><th>Market Skill</th><th>Native Skill</th><th>Action</th><th>Reason</th></tr></thead>
    <tbody>
     {(data?.recent||[]).slice(0,50).map((row,i)=><tr key={row.challengerId+'|'+row.observedAt+'|'+i}>
      <td><span className="sportPill">{row.state}</span></td><td>{row.leagueId??'—'}</td><td>{row.leagueRank??'—'}</td>
      <td>{row.sport}</td><td>{row.marketKey}</td><td>{row.sampleSize}</td><td>{num(row.leagueScore)}</td>
      <td className={row.marketBrierSkillScore>0?'lime':'negative'}>{pct(row.marketBrierSkillScore)}</td>
      <td className={row.nativeBrierSkillScore>0?'lime':'negative'}>{pct(row.nativeBrierSkillScore)}</td>
      <td><b>{row.action}</b><small>{row.priorConfirmations} prior</small></td>
      <td><small>{row.reason}</small></td>
     </tr>)}
     {!data?.recent?.length&&<tr><td colSpan={11} className="emptyRow">No live shadow league evaluation has run yet.</td></tr>}
    </tbody>
   </table>
  </div>
 </section>;
}
