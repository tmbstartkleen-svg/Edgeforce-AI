'use client';

import {useEffect,useState} from 'react';

type Row={state:'PRIME'|'READY'|'WATCH'|'HOLD'|'REMOVE';samples:number;gradedSamples:number;positiveRate:number;averageUtility:number;averageScoreDelta:number;averageEdgeDelta:number;averageCapturedValue:number;decayRate:number;confidence:number};
type Payload={summary:Row[];ordering:{status:string;score:number}};
const pct=(n:number)=>(n*100).toFixed(1)+'%';

export default function DecisionReplayPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;const load=async()=>{try{const res=await fetch('/api/intelligence/decision-replay',{cache:'no-store'});if(!res.ok)throw new Error('decision replay unavailable');const json=await res.json() as Payload;if(active){setData(json);setError('')}}catch(e){if(active)setError(e instanceof Error?e.message:'decision replay unavailable')}};void load();const timer=window.setInterval(()=>void load(),180000);return()=>{active=false;window.clearInterval(timer)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V119 DECISION REPLAY</div><h3>End-to-End Decision Backtest & Ordering Validation</h3></div><div className="panelMeta"><span>{data?.ordering.status||'LOADING'}</span><span>Separation {pct(data?.ordering.score||0)}</span></div></div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="historyGrid">
   <div className="historyBox"><h4>Decision-state replay</h4>
    {(data?.summary||[]).map(x=><div className="historyRow" key={x.state}>
     <span>{x.state}</span><b>{pct(x.averageUtility)} utility</b>
     <small>n={x.samples} • graded {x.gradedSamples} • positive {pct(x.positiveRate)} • confidence {pct(x.confidence)}</small>
     <small>score Δ {(x.averageScoreDelta*100).toFixed(1)} pts • edge Δ {(x.averageEdgeDelta*100).toFixed(1)} pts • capture {x.averageCapturedValue.toFixed(2)} pts • decay {pct(x.decayRate)}</small>
    </div>)}
    {!data?.summary?.length&&<div className="historyRow"><span>No replay evidence yet</span><b>BUILDING</b><small>V119 needs persisted historical decision snapshots before ordering can be validated.</small></div>}
   </div>
   <div className="historyBox"><h4>Validation standard</h4>
    <div className="historyRow"><span>PRIME &gt; READY &gt; WATCH</span><b>{data?.ordering.status||'—'}</b><small>Requires at least 20 graded samples in each of those states.</small></div>
    <div className="historyRow"><span>HOLD / REMOVE</span><b>CAUTION TEST</b><small>They receive utility when later lifecycle decay validates the caution signal.</small></div>
    <div className="historyRow"><span>Forward window</span><b>6 HOURS</b><small>Uses subsequent score, edge, price-capture, and lifecycle evidence.</small></div>
    <div className="historyRow"><span>Execution</span><b>OFF</b><small>Replay validates prioritization only.</small></div>
   </div>
  </div>
 </section>;
}