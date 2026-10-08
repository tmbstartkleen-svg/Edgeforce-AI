'use client';

import {useEffect,useMemo,useState} from 'react';

type Metrics={
 sampleSize:number;effectiveSampleSize:number;brierScore:number;logLoss:number;
 calibrationError:number;sharpness:number;meanForecast:number;observedRate:number;
};
type Replay={
 prior:Metrics;recent:Metrics;brierDelta:number;logLossDelta:number;
 calibrationDelta:number;sharpnessDelta:number;state:'STABLE'|'WATCH'|'DRIFTING'|'INSUFFICIENT';
};
type Band={
 label:string;sampleSize:number;effectiveSampleSize:number;meanForecast:number;
 observedRate:number;calibrationGap:number;direction:string;
};
type Scorecard={
 modelName:string;sport:string;marketKey:string;sampleSize:number;effectiveSampleSize:number;
 brierScore:number;logLoss:number;calibrationError:number;sharpness:number;
 recentEffectiveSampleSize:number;priorEffectiveSampleSize:number;
 brierDelta:number;calibrationDelta:number;driftState:string;researchGrade:string;
};
type Payload={
 ok:boolean;source:string;rows:number;filters:{sport:string|null;market:string|null;model:string|null;days:number;limit:number};
 report:{
  schemaVersion:string;generatedAt:string;researchOnly:boolean;fingerprint:string;
  summary:Metrics;replay:Replay;reliability:Band[];scorecards:Scorecard[];grades:Record<string,number>;
 };
};

const pct=(n:number)=>Number.isFinite(n)?(n*100).toFixed(1)+'%':'—';
const dec=(n:number,d=3)=>Number.isFinite(n)?n.toFixed(d):'—';
const signed=(n:number)=>Number.isFinite(n)?(n>=0?'+':'')+n.toFixed(3):'—';

export default function ForecastResearchLabPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 const [days,setDays]=useState(365);
 const [sport,setSport]=useState('');
 const [model,setModel]=useState('');

 useEffect(()=>{
  let active=true;
  const params=new URLSearchParams({days:String(days),limit:'10000'});
  if(sport.trim())params.set('sport',sport.trim());
  if(model.trim())params.set('model',model.trim());
  fetch('/api/intelligence/forecast-research?'+params.toString(),{cache:'no-store'})
   .then(async res=>{
    if(!res.ok)throw new Error('forecast research unavailable');
    return res.json() as Promise<Payload>;
   })
   .then(json=>{if(active){setData(json);setError('')}})
   .catch(err=>{if(active)setError(err instanceof Error?err.message:'forecast research unavailable')});
  return()=>{active=false};
 },[days,sport,model]);

 const populated=useMemo(()=>data?.report.reliability.filter(x=>x.effectiveSampleSize>0)||[],[data]);
 const r=data?.report;

 return <main className="v21 shell">
  <section className="v21Top">
   <div>
    <div className="eyebrow">V155 FORECAST RESEARCH LAB</div>
    <h1>Calibration, temporal replay, reliability and model research</h1>
    <p>Research-only evaluation of historical probability forecasts. No stake sizing, order execution, or real-money recommendation output is produced here.</p>
   </div>
   <div className="v21Status">
    <div className="dot liveDot"/>
    <div><small>SOURCE</small><b>{data?.source?.toUpperCase()||'LOADING'}</b></div>
    <div><small>ROWS</small><b>{data?.rows??0}</b></div>
    <div><small>FINGERPRINT</small><b>{r?.fingerprint||'—'}</b></div>
   </div>
  </section>

  {error&&<div className="v21Alert">{error}</div>}

  <section className="v21Card">
   <div className="v21CardHead"><div><div className="eyebrow">RESEARCH SCOPE</div><h3>Historical forecast window</h3></div><span>READ ONLY</span></div>
   <div className="statRow">
    <div><small>DAYS</small><strong>{days}</strong></div>
    <div><small>SPORT FILTER</small><strong>{sport||'ALL'}</strong></div>
    <div><small>MODEL FILTER</small><strong>{model||'ALL'}</strong></div>
    <div><small>SCHEMA</small><strong>V155</strong></div>
   </div>
   <div style={{display:'flex',gap:10,flexWrap:'wrap',padding:'12px 0'}}>
    {[30,90,365,1095].map(value=><button key={value} onClick={()=>setDays(value)}>{value}D</button>)}
    <input value={sport} onChange={e=>setSport(e.target.value)} placeholder="Sport filter"/>
    <input value={model} onChange={e=>setModel(e.target.value)} placeholder="Model filter"/>
   </div>
  </section>

  <section className="v21Grid four">
   <div className="v21Card"><div className="eyebrow">EFFECTIVE SAMPLE</div><h3>{r?dec(r.summary.effectiveSampleSize,1):'—'}</h3><p className="muted">{r?.summary.sampleSize??0} raw settled forecasts</p></div>
   <div className="v21Card"><div className="eyebrow">BRIER SCORE</div><h3>{r?dec(r.summary.brierScore):'—'}</h3><p className="muted">Lower is better probability accuracy.</p></div>
   <div className="v21Card"><div className="eyebrow">CALIBRATION ERROR</div><h3>{r?pct(r.summary.calibrationError):'—'}</h3><p className="muted">Weighted reliability gap.</p></div>
   <div className="v21Card"><div className="eyebrow">TEMPORAL STATE</div><h3>{r?.replay.state||'—'}</h3><p className="muted">Recent Brier Δ {r?signed(r.replay.brierDelta):'—'}</p></div>
  </section>

  <section className="v21Card">
   <div className="v21CardHead"><div><div className="eyebrow">MODEL SCORECARDS</div><h3>Historical forecast quality by model / sport / market</h3></div><span>{r?.scorecards.length??0} groups</span></div>
   <div className="tableWrap"><table>
    <thead><tr><th>Model</th><th>Sport</th><th>Market</th><th>Grade</th><th>Effective N</th><th>Brier</th><th>Log loss</th><th>Calibration</th><th>Recent drift</th></tr></thead>
    <tbody>
     {(r?.scorecards||[]).slice(0,100).map(row=><tr key={[row.modelName,row.sport,row.marketKey].join('|')}>
      <td><b>{row.modelName}</b></td><td>{row.sport}</td><td>{row.marketKey}</td><td>{row.researchGrade}</td>
      <td>{dec(row.effectiveSampleSize,1)}</td><td>{dec(row.brierScore)}</td><td>{dec(row.logLoss)}</td>
      <td>{pct(row.calibrationError)}</td><td>{row.driftState} · {signed(row.brierDelta)}</td>
     </tr>)}
     {!r?.scorecards.length&&<tr><td colSpan={9} className="emptyRow">No settled historical forecasts match this research window.</td></tr>}
    </tbody>
   </table></div>
  </section>

  <section className="historyGrid">
   <div className="historyBox">
    <h4>Temporal replay</h4>
    <div className="historyRow"><span>Prior window</span><b>{r?dec(r.replay.prior.effectiveSampleSize,1):'—'} eff.</b><small>Brier {r?dec(r.replay.prior.brierScore):'—'} · calibration {r?pct(r.replay.prior.calibrationError):'—'}</small></div>
    <div className="historyRow"><span>Recent window</span><b>{r?dec(r.replay.recent.effectiveSampleSize,1):'—'} eff.</b><small>Brier {r?dec(r.replay.recent.brierScore):'—'} · calibration {r?pct(r.replay.recent.calibrationError):'—'}</small></div>
    <div className="historyRow"><span>Drift state</span><b>{r?.replay.state||'—'}</b><small>Brier Δ {r?signed(r.replay.brierDelta):'—'} · log-loss Δ {r?signed(r.replay.logLossDelta):'—'} · calibration Δ {r?signed(r.replay.calibrationDelta):'—'}</small></div>
   </div>
   <div className="historyBox">
    <h4>Research-grade distribution</h4>
    {Object.entries(r?.grades||{}).map(([grade,count])=><div className="historyRow" key={grade}><span>{grade}</span><b>{count}</b><small>Model / sport / market groups</small></div>)}
    {!Object.keys(r?.grades||{}).length&&<div className="historyRow"><span>No grade data</span><b>—</b><small>Waiting for settled historical forecasts.</small></div>}
   </div>
  </section>

  <section className="v21Card">
   <div className="v21CardHead"><div><div className="eyebrow">RELIABILITY CURVE</div><h3>Forecast probability vs observed frequency</h3></div><span>{populated.length} populated bands</span></div>
   <div className="tableWrap"><table>
    <thead><tr><th>Forecast band</th><th>Raw N</th><th>Effective N</th><th>Mean forecast</th><th>Observed</th><th>Gap</th><th>State</th></tr></thead>
    <tbody>
     {populated.map(band=><tr key={band.label}><td>{band.label}</td><td>{band.sampleSize}</td><td>{dec(band.effectiveSampleSize,1)}</td><td>{pct(band.meanForecast)}</td><td>{pct(band.observedRate)}</td><td>{pct(band.calibrationGap)}</td><td>{band.direction}</td></tr>)}
     {!populated.length&&<tr><td colSpan={7} className="emptyRow">No populated reliability bands.</td></tr>}
    </tbody>
   </table></div>
  </section>

  <div className="historyNote">Research-only surface. Scores describe historical forecast quality and calibration; they are not instructions to place wagers or execute trades.</div>
 </main>;
}
