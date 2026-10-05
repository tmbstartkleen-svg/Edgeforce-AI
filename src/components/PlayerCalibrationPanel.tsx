'use client';

import {useEffect,useState} from 'react';

type Summary={
 ok:boolean;configured:boolean;totalProfiles:number;qualifiedProfiles:number;totalSamples:number;
 top:Array<{playerName:string;sport:string;statKey:string;direction:string;sampleSize:number;observedHitRate:number;averageModelProbability:number;calibrationBias:number;confidence:number;brierScore:number}>;
};

const pct=(n:number)=>Math.round(n*1000)/10+'%';

export default function PlayerCalibrationPanel(){
 const [data,setData]=useState<Summary|null>(null);
 useEffect(()=>{let on=true;fetch('/api/intelligence/player-calibration',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(on)setData(x)}).catch(()=>{});return()=>{on=false}},[]);
 return <section className="v21Card">
  <div className="v21CardHead">
   <div><div className="eyebrow">V63 PLAYER LEARNING</div><h3>Settled-result calibration</h3></div>
   <span>{data?.configured?'ACTIVE':'WAITING'}</span>
  </div>
  <div className="statRow">
   <div><small>PROFILES</small><strong>{data?.totalProfiles??0}</strong></div>
   <div><small>QUALIFIED</small><strong>{data?.qualifiedProfiles??0}</strong></div>
   <div><small>SETTLED SAMPLES</small><strong>{data?.totalSamples??0}</strong></div>
  </div>
  <p className="muted">Per-player, per-stat, per-direction corrections are learned from settled results, shrunk toward the model prior, and capped at ±6 percentage points before simulation.</p>
  <div className="tableWrap">
   <table>
    <thead><tr><th>Player</th><th>Sport / Stat</th><th>Dir</th><th>N</th><th>Model</th><th>Observed</th><th>Bias</th><th>Confidence</th></tr></thead>
    <tbody>
     {(data?.top||[]).slice(0,12).map(x=><tr key={x.playerName+x.sport+x.statKey+x.direction}>
      <td><b>{x.playerName}</b></td><td>{x.sport} • {x.statKey}</td><td>{x.direction}</td><td>{x.sampleSize}</td>
      <td>{pct(x.averageModelProbability)}</td><td>{pct(x.observedHitRate)}</td><td>{x.calibrationBias>=0?'+':''}{pct(x.calibrationBias)}</td><td>{pct(x.confidence)}</td>
     </tr>)}
     {!data?.top?.length&&<tr><td colSpan={8} className="emptyRow">Calibration activates after at least eight settled samples for a player/stat/direction profile.</td></tr>}
    </tbody>
   </table>
  </div>
 </section>;
}
