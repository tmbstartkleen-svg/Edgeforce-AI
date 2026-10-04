'use client';

import {useEffect,useState} from 'react';

type Winner={
 sport:string;marketKey:string;algorithm:string;serviceModelId:string;
 compositeScore:number;brierSkillScore:number;holdoutBrier:number;marketBaselineBrier:number;
 calibrationError:number;
};
type Leaderboard={
 group:string;sport:string;marketKey:string;winner:Winner|null;runnerUp:Winner|null;
 margin:number|null;marketBrierImprovement:number;eligibleCount:number;candidates:Winner[];
};
type Payload={
 ok:boolean;build:string;schemaVersion:string;
 latest?:{
  status:string;tournamentRunId?:number|null;activationState?:string|null;serviceVersion?:string|null;
  candidatesEvaluated:number;championsBefore:number;championsAfter:number;championChanges:number;
  sportsCovered:number;artifactsVerified:number;artifactsMissing:number;
  leaderboard:Leaderboard[];coverage?:{evidence?:{grade?:string;launchReady?:boolean;reason?:string}};
  startedAt?:string;completedAt?:string|null;error?:string|null;
 }|null;
 championHistory?:Array<{
  tournamentRunId?:number|null;sport:string;marketKey:string;algorithm:string;serviceModelId:string;
  action:string;compositeScore:number;brierSkillScore:number;reason?:string;recordedAt?:string;
 }>;
};

const pct=(n:number)=>(n*100).toFixed(1)+'%';
const signed=(n:number)=>(n>=0?'+':'')+(n*100).toFixed(1)+'%';

export default function FirstChampionTournamentPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/ml-champions',{cache:'no-store'});
    if(!res.ok)throw new Error('first tournament intelligence unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){
    if(active)setError(e instanceof Error?e.message:'first tournament intelligence unavailable');
   }
  };
  void load();
  const timer=window.setInterval(()=>void load(),30000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const latest=data?.latest;
 const leaderboard=latest?.leaderboard||[];
 const evidence=latest?.coverage?.evidence;
 const history=data?.championHistory||[];

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V61 FIRST CHAMPION TOURNAMENT</div>
    <h3>Sport-by-sport heavyweight ML winners, runner-ups, artifact verification, and promotion history</h3>
   </div>
   <div className="panelMeta">
    <span>{latest?.status?.toUpperCase()||'NOT RUN'}</span>
    <span>{evidence?.grade||'NO EVIDENCE'}</span>
    <span>{latest?.serviceVersion||'service pending'}</span>
   </div>
  </div>

  {error&&<div className="v21Alert">{error}</div>}

  <div className="v21Stats">
   <div><small>CANDIDATES</small><strong>{latest?.candidatesEvaluated??0}</strong><span>exact tournament candidates</span></div>
   <div><small>CHAMPIONS</small><strong>{latest?.championsAfter??0}</strong><span>{latest?.sportsCovered??0} sports covered</span></div>
   <div><small>CHAMPION CHANGES</small><strong>{latest?.championChanges??0}</strong><span>new or replaced production winners</span></div>
   <div><small>ARTIFACTS VERIFIED</small><strong>{latest?.artifactsVerified??0}</strong><span>{latest?.artifactsMissing??0} missing</span></div>
  </div>

  <div className="historyNote">{evidence?.reason||'No first-tournament evidence has been recorded yet.'}</div>

  <div className="v21PanelHead">
   <div><div className="eyebrow">ALGORITHM LEADERBOARD</div><h3>Winner and runner-up for each sport / market group</h3></div>
  </div>
  <div className="tableWrap">
   <table className="v21Table">
    <thead><tr><th>Sport</th><th>Market</th><th>Winner</th><th>Runner-up</th><th>Brier Skill</th><th>Market Improvement</th><th>Margin</th><th>Eligible</th></tr></thead>
    <tbody>
     {leaderboard.map(row=><tr key={row.group}>
      <td><span className="sportPill">{row.sport}</span></td>
      <td>{row.marketKey}</td>
      <td>{row.winner?<><b>{row.winner.algorithm}</b><small>{row.winner.serviceModelId}</small></>:'—'}</td>
      <td>{row.runnerUp?<><b>{row.runnerUp.algorithm}</b><small>{row.runnerUp.serviceModelId}</small></>:'—'}</td>
      <td className={(row.winner?.brierSkillScore||0)>0?'lime':'negative'}>{row.winner?signed(row.winner.brierSkillScore):'—'}</td>
      <td>{pct(row.marketBrierImprovement)}</td>
      <td>{row.margin==null?'—':row.margin.toFixed(3)}</td>
      <td>{row.eligibleCount}</td>
     </tr>)}
     {!leaderboard.length&&<tr><td colSpan={8} className="emptyRow">No heavyweight tournament has been run against settled EdgeForce history yet.</td></tr>}
    </tbody>
   </table>
  </div>

  <div className="v21PanelHead">
   <div><div className="eyebrow">CHAMPION HISTORY</div><h3>Promotion and replacement audit trail</h3></div>
  </div>
  <div className="tableWrap">
   <table className="v21Table">
    <thead><tr><th>Action</th><th>Sport</th><th>Market</th><th>Algorithm</th><th>Brier Skill</th><th>Composite</th><th>Reason</th></tr></thead>
    <tbody>
     {history.slice(0,40).map((row,i)=><tr key={row.serviceModelId+'|'+i}>
      <td><span className="sportPill">{row.action}</span></td>
      <td>{row.sport}</td><td>{row.marketKey}</td><td><b>{row.algorithm}</b><small>{row.serviceModelId}</small></td>
      <td className={row.brierSkillScore>0?'lime':'negative'}>{signed(row.brierSkillScore)}</td>
      <td>{row.compositeScore.toFixed(3)}</td><td><small>{row.reason||'—'}</small></td>
     </tr>)}
     {!history.length&&<tr><td colSpan={7} className="emptyRow">Champion history begins after the first hosted tournament completes.</td></tr>}
    </tbody>
   </table>
  </div>

  <div className="historyNote">A database champion is not considered launch-ready unless the hosted ML service confirms that the matching serialized artifact exists on persistent storage.</div>
 </section>;
}
