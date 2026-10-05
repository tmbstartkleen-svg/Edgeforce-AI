'use client';
import {useEffect,useState} from 'react';

type Row={sport:string;marketKey:string;scope:string;sampleCount:number;holdoutCount:number;councilWeight:number;simulationWeight:number;marketWeight:number;holdoutBrier:number;baselineHoldoutBrier:number;holdoutBrierGain:number;confidence:number;promoted:boolean;reason:string};
type Summary={configured:boolean;profiles:number;promoted:number;latestRun?:{eligibleRows?:number;profilesPromoted?:number}|null;rows:Row[]};
const pct=(n:number)=>Math.round(n*1000)/10+'%';
export default function CrossSportOptimizerPanel(){
 const [data,setData]=useState<Summary|null>(null);
 useEffect(()=>{let on=true;fetch('/api/intelligence/cross-sport-optimizer',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(on)setData(x)}).catch(()=>{});return()=>{on=false}},[]);
 return <section className="v21Card">
  <div className="v21CardHead"><div><div className="eyebrow">V70 AUTO-OPTIMIZER</div><h3>Cross-sport final probability weights</h3></div><span>{data?.configured?'ACTIVE':'WAITING'}</span></div>
  <div className="statRow"><div><small>PROFILES</small><strong>{data?.profiles??0}</strong></div><div><small>PROMOTED</small><strong>{data?.promoted??0}</strong></div><div><small>SETTLED ROWS</small><strong>{data?.latestRun?.eligibleRows??0}</strong></div></div>
  <p className="muted">Chronological holdouts tune the final Council / Simulation / Market blend. Sparse groups inherit sport/global priors; only profiles that beat their prior out-of-sample are activated.</p>
  <div className="tableWrap"><table><thead><tr><th>Scope</th><th>Sport / Market</th><th>Council</th><th>Simulation</th><th>Market</th><th>Holdout gain</th><th>Confidence</th><th>Status</th></tr></thead>
   <tbody>{(data?.rows||[]).slice(0,16).map(x=><tr key={x.sport+x.marketKey}><td>{x.scope}</td><td><b>{x.sport}</b><br/><small>{x.marketKey}</small></td><td>{pct(x.councilWeight)}</td><td>{pct(x.simulationWeight)}</td><td>{pct(x.marketWeight)}</td><td>{x.holdoutBrierGain>=0?'+':''}{x.holdoutBrierGain.toFixed(4)}</td><td>{pct(x.confidence)}</td><td>{x.promoted?'PROMOTED':'HELD'}</td></tr>)}{!data?.rows?.length&&<tr><td colSpan={8} className="emptyRow">Profiles populate after settled Model Council history is available.</td></tr>}</tbody>
  </table></div>
 </section>;
}
