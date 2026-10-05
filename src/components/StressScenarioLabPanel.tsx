'use client';

import {useEffect,useState} from 'react';

type ScenarioResult={scenarioId:string;stressedScore:number;stressedState:string;scoreDelta:number;stateDrop:number;edgeAfter:number;confidenceAfter:number;survivesPriority:boolean;reasons:string[]};
type Row={id:string;domain:'SPORTS'|'MARKETS';category:string;venue:string;title:string;baselineState:string;baselineScore:number;baselineEdge:number;baselineConfidence:number;scenarioResults:ScenarioResult[];robustnessScore:number;survivalRate:number;worstScenario:string;worstScore:number;worstState:string;classification:'ROBUST'|'RESILIENT'|'FRAGILE'|'FAIL'};
type Payload={summary:{robust:number;resilient:number;fragile:number;fail:number;primeReadyFragile:number};rows:Row[]};
const pct=(n:number)=>(n*100).toFixed(1)+'%';

export default function StressScenarioLabPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;const load=async()=>{try{const res=await fetch('/api/intelligence/stress-scenario-lab',{cache:'no-store'});if(!res.ok)throw new Error('stress scenario lab unavailable');const json=await res.json() as Payload;if(active){setData(json);setError('')}}catch(e){if(active)setError(e instanceof Error?e.message:'stress scenario lab unavailable')}};void load();const timer=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(timer)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V120 STRESS TEST LAB</div><h3>Scenario Shocks & Decision Robustness</h3></div><div className="panelMeta"><span>Robust {data?.summary.robust||0}</span><span>Fragile {(data?.summary.fragile||0)+(data?.summary.fail||0)}</span><span>Prime/Ready fragile {data?.summary.primeReadyFragile||0}</span></div></div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="historyGrid">
   <div className="historyBox"><h4>Opportunity robustness</h4>
    {(data?.rows||[]).slice(0,15).map(x=><div className="historyRow" key={x.id}>
     <span>{x.title}</span><b>{x.classification} · {pct(x.robustnessScore)}</b>
     <small>{x.domain} • {x.category} • baseline {x.baselineState} {pct(x.baselineScore)} • survives {pct(x.survivalRate)}</small>
     <small>worst {x.worstScenario} → {x.worstState} {pct(x.worstScore)} • baseline edge {(x.baselineEdge*100).toFixed(1)} pts</small>
    </div>)}
    {!data?.rows?.length&&<div className="historyRow"><span>No current opportunities</span><b>—</b><small>Stress results appear when the Master Edge board has current candidates.</small></div>}
   </div>
   <div className="historyBox"><h4>Shock set</h4>
    <div className="historyRow"><span>Adverse line move</span><b>4 pts</b><small>Tests price erosion against the modeled edge.</small></div>
    <div className="historyRow"><span>Model / injury miss</span><b>7 pts</b><small>Sports probability and confidence shock.</small></div>
    <div className="historyRow"><span>Stale feed / liquidity</span><b>SEVERE</b><small>Reduces timing and executable venue quality.</small></div>
    <div className="historyRow"><span>Correlation / tail / compound</span><b>ON</b><small>Tests dependency failure, regression toward uncertainty, and simultaneous shocks.</small></div>
   </div>
  </div>
  <div className="historyNote">V120 is sensitivity analysis, not a forecast. A fragile PRIME/READY label means the opportunity depends heavily on assumptions that deserve re-checking.</div>
 </section>;
}