'use client';
import {useEffect,useMemo,useState} from 'react';
import Sparkline from './Sparkline';

const pct=(n:number)=>Number.isFinite(n)?(n*100).toFixed(1)+'%':'—';
const signedPct=(n:number)=>Number.isFinite(n)?((n>=0?'+':'')+(n*100).toFixed(1)+'%'):'—';

export default function MarketDrilldown({marketId,onClose}:{marketId:string;onClose:()=>void}){
 const [detail,setDetail]=useState<any>(null);
 const [lines,setLines]=useState<any[]>([]);
 const [scenario,setScenario]=useState<any>(null);
 const [busy,setBusy]=useState(false);
 const [lineMove,setLineMove]=useState(0);
 const [homeAdjustment,setHomeAdjustment]=useState(0);
 const [featureKey,setFeatureKey]=useState('');
 const [featureDelta,setFeatureDelta]=useState(0);

 useEffect(()=>{
  Promise.all([
   fetch('/api/market/'+encodeURIComponent(marketId),{cache:'no-store'}).then(r=>r.json()),
   fetch('/api/market/'+encodeURIComponent(marketId)+'/lines',{cache:'no-store'}).then(r=>r.json())
  ]).then(([d,l])=>{
   setDetail(d);
   setLines(l.points||[]);
   const first=d?.explanation?.featureAblations?.[0]?.feature||'';
   setFeatureKey(first);
  }).catch(()=>{});
 },[marketId]);

 const runScenario=async()=>{
  setBusy(true);
  try{
   const featureDeltas=featureKey&&featureDelta!==0?{[featureKey]:featureDelta}:{};
   const res=await fetch('/api/what-if',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
     marketId,
     context:{lineMovePct:lineMove/100,homeAdvantage:homeAdjustment/100},
     featureDeltas,
     bankroll:1000
    })
   });
   setScenario(await res.json());
  }finally{setBusy(false)}
 };

 const council=detail?.council;
 const scan=detail?.scan?.[0];
 const explanation=detail?.explanation;
 const topDrivers=explanation?.topDrivers||[];
 const modelAblations=explanation?.componentAblations||[];
 const featureAblations=explanation?.featureAblations||[];
 const featureOptions=useMemo(()=>featureAblations.map((x:any)=>x.feature),[featureAblations]);

 return <div className="drillOverlay" onClick={onClose}>
  <div className="drillPanel" onClick={e=>e.stopPropagation()}>
   <div className="drillHead"><div><div className="eyebrow">V40 EXPLAINABLE MARKET DRILL-DOWN</div><h3>{detail?.market?.event||marketId}</h3></div><button onClick={onClose}>CLOSE</button></div>
   {!detail&&<p className="emptyState">Loading market detail…</p>}
   {detail&&<>
    <div className="drillStats">
     <div><small>SELECTION</small><strong>{detail.market?.selection||'—'}</strong></div>
     <div><small>MARKET P</small><strong>{detail.market?pct(Number(detail.market.marketProb)):'—'}</strong></div>
     <div><small>ENSEMBLE</small><strong>{council?pct(Number(council.ensemble)):'—'}</strong></div>
     <div><small>CALIBRATED SIM</small><strong>{scan?pct(Number(scan.simProbability)):'—'}</strong></div>
     <div><small>DYNAMIC CONF</small><strong>{scan?pct(Number(scan.dynamicConfidence)):'—'}</strong></div>
     <div><small>FRAGILITY</small><strong>{explanation?.diagnostics?.fragility||'—'}</strong></div>
    </div>

    <div className="drillGrid">
     <div className="consoleCard">
      <div className="eyebrow">WHY THE MODEL MOVED</div>
      {(explanation?.summary||[]).map((x:string,i:number)=><p className="historyNote" key={i}>{x}</p>)}
      {topDrivers.slice(0,8).map((x:any)=><div className="voteRow" key={x.kind+x.name}>
       <span>{x.kind} • {x.name}</span>
       <b className={x.impact>=0?'lime':'orange'}>{signedPct(Number(x.impact))}</b>
       <small>{x.direction}</small>
      </div>)}
     </div>
     <div className="consoleCard">
      <div className="eyebrow">MODEL COUNCIL</div>
      {(council?.votes||[]).map((v:any)=><div className="voteRow" key={v.name}><span>{v.name}</span><b>{pct(Number(v.prob))}</b><small>{pct(Number(v.weight))} raw weight</small></div>)}
     </div>
    </div>

    <div className="drillGrid">
     <div className="consoleCard">
      <div className="eyebrow">LEAVE-ONE-MODEL-OUT ABLATION</div>
      {modelAblations.slice(0,7).map((x:any)=><div className="voteRow" key={x.name}>
       <span>{x.name}</span><b className={x.delta>=0?'lime':'orange'}>{signedPct(Number(x.delta))}</b>
       <small>without {pct(Number(x.withoutProbability))}</small>
      </div>)}
     </div>
     <div className="consoleCard">
      <div className="eyebrow">FEATURE SENSITIVITY</div>
      {featureAblations.slice(0,7).map((x:any)=><div className="voteRow" key={x.feature}>
       <span>{x.feature} • value {Number(x.value).toFixed(2)}</span>
       <b className={x.delta>=0?'lime':'orange'}>{signedPct(Number(x.delta))}</b>
       <small>sensitivity/unit {signedPct(Number(x.sensitivityPerUnit))}</small>
      </div>)}
      {!featureAblations.length&&<p className="emptyState">No active context features are available for this market.</p>}
     </div>
    </div>

    <div className="drillGrid">
     <div className="consoleCard">
      <div className="eyebrow">LINE MOVEMENT</div>
      <Sparkline label="American odds" values={lines.map((x:any)=>Number(x.odds))}/>
      <Sparkline label="Implied probability" values={lines.map((x:any)=>Number(x.impliedProbability||0)*100)}/>
     </div>
     <div className="consoleCard">
      <div className="eyebrow">DIAGNOSTICS</div>
      <div className="healthRow"><div><b>Effective model count</b><small>inverse weight concentration</small></div><span>{Number(explanation?.diagnostics?.effectiveModelCount||0).toFixed(1)}</span></div>
      <div className="healthRow"><div><b>Dominant model</b><small>largest normalized weight</small></div><span>{explanation?.diagnostics?.dominantModel||'—'} {pct(Number(explanation?.diagnostics?.dominantWeight||0))}</span></div>
      <div className="healthRow"><div><b>Council agreement</b><small>cross-model probability agreement</small></div><span>{pct(Number(explanation?.diagnostics?.councilAgreement||0))}</span></div>
      <div className="healthRow"><div><b>Contribution check</b><small>reconstruction error</small></div><span>{Number(explanation?.contributionError||0).toExponential(1)}</span></div>
     </div>
    </div>

    <div className="scenarioBox">
     <div>
      <div className="eyebrow">LIVE READ-ONLY WHAT-IF</div>
      <p>Change context inputs below. The scenario is recalculated without writing to odds history, calibration history, wagers, or model learning.</p>
     </div>
    </div>
    <div className="v21ControlPanel">
     <div className="controlGroup"><label>Line move %</label><input type="number" step="0.5" min="-20" max="20" value={lineMove} onChange={e=>setLineMove(Number(e.target.value)||0)}/></div>
     <div className="controlGroup"><label>Home probability pts</label><input type="number" step="0.5" min="-10" max="10" value={homeAdjustment} onChange={e=>setHomeAdjustment(Number(e.target.value)||0)}/></div>
     <div className="controlGroup"><label>Feature</label><select value={featureKey} onChange={e=>setFeatureKey(e.target.value)}><option value="">No feature</option>{featureOptions.map((x:string)=><option key={x}>{x}</option>)}</select></div>
     <div className="controlGroup"><label>Feature delta</label><input type="number" step="0.05" min="-1" max="1" value={featureDelta} onChange={e=>setFeatureDelta(Math.max(-1,Math.min(1,Number(e.target.value)||0)))}/></div>
     <div className="controlGroup"><label>Scenario</label><button disabled={busy} onClick={runScenario}>{busy?'RUNNING…':'RUN WHAT-IF'}</button></div>
    </div>

    {scenario&&<div className="scenarioResult">
     <b>Scenario delta</b>
     <span>{'Ensemble '+signedPct(Number(scenario.delta?.ensembleProbability||0))}</span>
     <span>{'Simulation '+signedPct(Number(scenario.delta?.simulationProbability||0))}</span>
     <span>{'Confidence '+signedPct(Number(scenario.delta?.dynamicConfidence||0))}</span>
     <span>{'Stake '+signedPct(Number(scenario.delta?.recommendedStake||0))}</span>
     <span>{'Grade '+String(scenario.delta?.grade?.before||'—')+' → '+String(scenario.delta?.grade?.after||'—')}</span>
     <span>{'Regime '+String(scenario.delta?.regime?.before||'—')+' → '+String(scenario.delta?.regime?.after||'—')}</span>
     <span>{'Fragility '+String(scenario.delta?.fragility?.before||'—')+' → '+String(scenario.delta?.fragility?.after||'—')}</span>
    </div>}
   </>}
  </div>
 </div>;
}
