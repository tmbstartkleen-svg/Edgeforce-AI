'use client';

import {useEffect,useState} from 'react';

type Row={sportsbook:string;alertType:string;samples:number;recentSamples:number;baselineRegret:number;learnedRegret:number;regretImprovement:number;baselineAccuracy:number;learnedAccuracy:number;accuracyLift:number;recentLearnedRegret:number;driftScore:number;confidence:number;role:string;health:string;promoted:boolean;reason:string};
type Payload={summary:{champions:number;challengers:number;baseline:number;drifting:number};rows:Row[]};
const pct=(n:number)=>(n*100).toFixed(1)+'%';

export default function CashoutPolicyGovernancePanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;const load=async()=>{try{const res=await fetch('/api/intelligence/cashout-policy-governance',{cache:'no-store'});if(!res.ok)throw new Error('cash-out policy governance unavailable');const json=await res.json() as Payload;if(active){setData(json);setError('')}}catch(e){if(active)setError(e instanceof Error?e.message:'cash-out policy governance unavailable')}};void load();const timer=window.setInterval(()=>void load(),180000);return()=>{active=false;window.clearInterval(timer)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V118 CASH-OUT GOVERNANCE</div><h3>Regret, Drift & Champion / Challenger Control</h3></div><div className="panelMeta"><span>Champions {data?.summary.champions||0}</span><span>Challengers {data?.summary.challengers||0}</span><span>Drifting {data?.summary.drifting||0}</span></div></div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="historyGrid">
   <div className="historyBox"><h4>Policy governance</h4>
    {(data?.rows||[]).slice(0,14).map(x=><div className="historyRow" key={x.sportsbook+'|'+x.alertType}>
     <span>{x.sportsbook} · {x.alertType}</span><b>{x.role} · {x.health}</b>
     <small>n={x.samples} • recent {x.recentSamples} • confidence {pct(x.confidence)}</small>
     <small>regret baseline {pct(x.baselineRegret)} • learned {pct(x.learnedRegret)} • improvement {pct(x.regretImprovement)}</small>
     <small>accuracy lift {pct(x.accuracyLift)} • drift {pct(x.driftScore)} • {x.reason}</small>
    </div>)}
    {!data?.rows?.length&&<div className="historyRow"><span>No governance evidence yet</span><b>BASELINE</b><small>The original 1% threshold remains authoritative.</small></div>}
   </div>
   <div className="historyBox"><h4>Promotion gates</h4>
    <div className="historyRow"><span>Champion minimum</span><b>120 settled</b><small>Requires lower regret than baseline and non-negative accuracy lift.</small></div>
    <div className="historyRow"><span>Drift block</span><b>ON</b><small>Recent regret deterioration prevents promotion.</small></div>
    <div className="historyRow"><span>Baseline fallback</span><b>1%</b><small>Used whenever evidence is insufficient or learned policy regresses.</small></div>
    <div className="historyRow"><span>Execution</span><b>OFF</b><small>Governance changes advisory policy status only.</small></div>
   </div>
  </div>
 </section>;
}