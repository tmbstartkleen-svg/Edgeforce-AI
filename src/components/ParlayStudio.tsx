'use client';

import {useEffect,useMemo,useState} from 'react';
import type {Scanned} from '@/lib/scanner';
import type {LearnedSgpMap} from '@/lib/learnedSgpCorrelation';
import {analyzeCustomParlay} from '@/lib/parlays';
import {analyzeParlayConflicts,assessResearchLeg,rankResearchPool,type ParlayStrategy} from '@/lib/parlayResearch';

type Props={
 rows:Scanned[];
 source:string;
 degraded:boolean;
 learned?:LearnedSgpMap;
 generatedAt?:string;
 onInspect?:(item:{id:string;market:string;selection:string})=>void;
};
const fmt=(x:number)=>Number.isFinite(x)?(x*100).toFixed(1)+'%':'—';
const displayOdds=(x:number)=>Number.isFinite(x)?(x>0?'+':'')+Math.round(x):'—';
const startLabel=(x:string)=>{const d=new Date(x);return Number.isFinite(d.getTime())?d.toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}):'Unknown start'};
const typeLabel=(x:Scanned)=>x.playerContext?.name?'Player prop':/spread|handicap|run.line|puck.line/i.test(x.market)?'Spread':/total|over|under/i.test(x.market)?'Total':'Game market';

export default function ParlayStudio({rows,source,degraded,learned,generatedAt,onInspect}:Props){
 const [selected,setSelected]=useState<string[]>([]);
 const [strategy,setStrategy]=useState<ParlayStrategy>('BALANCED');
 const [sport,setSport]=useState('ALL');
 const [kind,setKind]=useState('ALL');
 const [showAll,setShowAll]=useState(false);
 const [nowMs,setNowMs]=useState(0);
 useEffect(()=>{const update=()=>setNowMs(Date.now());update();const ticker=window.setInterval(update,30000);return ()=>window.clearInterval(ticker)},[]);
 const boardAge=nowMs>0?nowMs-Date.parse(generatedAt||''):Number.POSITIVE_INFINITY;
 const boardVerified=source==='live'&&!degraded&&Number.isFinite(boardAge)&&boardAge>=0&&boardAge<=60000;
 const sports=useMemo(()=>[...new Set(rows.map(r=>r.sport))].sort(),[rows]);
 const ranked=useMemo(()=>rankResearchPool(rows,strategy,nowMs||0).filter(({row})=>
   (sport==='ALL'||row.sport===sport)&&(kind==='ALL'||typeLabel(row)===kind)
 ),[rows,strategy,sport,kind,nowMs]);
 const pool=showAll?ranked.slice(0,80):ranked.slice(0,20);
 const selectedRows=useMemo(()=>selected.map(id=>rows.find(row=>row.id===id)).filter((r):r is Scanned=>Boolean(r)),[selected,rows]);
 const conflicts=useMemo(()=>analyzeParlayConflicts(selectedRows),[selectedRows]);
 const result=useMemo(()=>selectedRows.length>=2&&selectedRows.length<=6&&conflicts.length===0
   ?analyzeCustomParlay(selectedRows,learned):null,[selectedRows,learned,conflicts]);
 const sameGame=selectedRows.length>1&&new Set(selectedRows.map(x=>x.event+'|'+x.startTime)).size<selectedRows.length;
 const passed=selectedRows.every(x=>assessResearchLeg(x,nowMs||0).eligible);
 const modelFlags=selectedRows.flatMap(x=>assessResearchLeg(x,nowMs||0).reasons);
 const quoteAvailable=boardVerified&&passed&&conflicts.length===0;
 const experimentalEv=Boolean(result)&&!sameGame;
 const toggle=(id:string)=>setSelected(current=>current.includes(id)?current.filter(x=>x!==id):current.length<6?[...current,id]:current);
 const chooseTop=()=>{
  const top=ranked.filter(x=>x.gate.eligible).slice(0,3).map(x=>x.row.id);
  setSelected(top);
 };
 return <section className="efParlayStudio" id="parlays" aria-label="Parlay laboratory">
  <div className="efStudioHeading">
   <div>
    <div className="efKicker">EDGEFORCE AI / PARLAY INTELLIGENCE / V198</div>
    <h2>Parlay Lab <span>Research workbench</span></h2>
    <p>Build from the strongest evidence, explore genuine joint-probability ranges and understand correlation before considering a sportsbook price.</p>
   </div>
   <div className={'efStudioStatus '+(boardVerified?'isGood':'isCaution')}>
    <span className="efStatusDot"/>
    <b>{boardVerified?'LIVE RESEARCH BOARD':'PRICE VERIFICATION UNAVAILABLE'}</b>
    <small>{boardVerified?'Live source received; parlay acceptance remains unconfirmed':'Stale, single-provider or unavailable sources cannot qualify entries'}</small>
   </div>
  </div>
  <div className="efStudioSummary">
   <div><small>Research legs received</small><strong>{rows.length}</strong><span>From current ranked view</span></div>
   <div><small>Strict leg candidates</small><strong>{ranked.filter(x=>x.gate.eligible).length}</strong><span>Model, context and book checks</span></div>
   <div><small>Selected legs</small><strong>{selectedRows.length}<em> / 6</em></strong><span>Interactive research slip</span></div>
   <div><small>Joint simulations</small><strong>{result?.jointSimulationRuns.toLocaleString()??'—'}</strong><span>Only when slip can be evaluated</span></div>
  </div>
  <div className="efStudioLayout">
   <div className="efStudioPool">
    <div className="efSectionTitle"><div><h3>Build your slip</h3><p>Choose 2–6 legs. Strict-eligible candidates appear first.</p></div><button type="button" className="efSubtleButton" onClick={()=>setSelected([])} disabled={!selected.length}>Clear slip</button></div>
    <div className="efStrategyPicker" role="group" aria-label="Parlay research approach">
     {([
      ['BALANCED','Balanced'],['HIGH_PROBABILITY','Highest probability'],['VALUE','Model value'],['UPSIDE','Upside research']
     ] as const).map(([id,label])=><button key={id} type="button" aria-pressed={strategy===id} className={strategy===id?'selected':''} onClick={()=>setStrategy(id)}>{label}</button>)}
    </div>
    <div className="efPoolFilters">
     <label>Sport <select value={sport} onChange={e=>setSport(e.target.value)}><option value="ALL">All sports</option>{sports.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
     <label>Market <select value={kind} onChange={e=>setKind(e.target.value)}><option value="ALL">Every market</option>{['Game market','Player prop','Spread','Total'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
     <button type="button" className="efSubtleButton" onClick={chooseTop}>Select top 3 eligible</button>
    </div>
    <div className="efPoolList" aria-label="Available parlay legs">
     {pool.map(({row,gate})=><article className={'efPoolRow '+(selected.includes(row.id)?'isSelected':'')} key={row.id}>
      <div className="efPoolRowPrimary">
       <div className="efRowTop"><span>{row.sport} / {typeLabel(row)}</span><small>{startLabel(row.startTime)}</small></div>
       <h4>{row.selection}</h4>
       <p>{row.event}</p>
       <div className="efRowMeta"><span>{row.sourceBook||'Book unverified'} · {displayOdds(row.odds)}</span><span>Model {fmt(row.simProbability)}</span><span>EV {fmt(row.expectedValue)}</span></div>
      </div>
      <div className="efPoolRowActions">
       <span className={'efQuality '+(gate.eligible&&boardVerified?'positive':'muted')}>{gate.eligible&&boardVerified?'MODEL GATES PASS':'RESEARCH ONLY'}</span>
       <b>{gate.score}<small> / 100</small></b>
       <button type="button" disabled={!selected.includes(row.id)&&selected.length>=6} aria-pressed={selected.includes(row.id)} onClick={()=>toggle(row.id)}>{selected.includes(row.id)?'Remove':'Add leg'}</button>
       <button type="button" className="efLinkButton" disabled={!onInspect} onClick={()=>onInspect?.({id:row.id,market:row.market,selection:row.selection})}>Inspect market</button>
      </div>
     </article>)}
     {!pool.length&&<div className="efEmpty">No received markets match these filters. This view never inserts simulated placeholder opportunities.</div>}
    </div>
    {ranked.length>20&&<button type="button" className="efShowMore" onClick={()=>setShowAll(x=>!x)}>{showAll?'Show fewer research legs':'Show more received markets'}</button>}
   </div>
   <aside className="efSlipPanel" aria-label="Correlation-aware parlay slip">
    <div className="efSlipHeader">
     <div><span className="efKicker">JOINT MODEL / PRICING CHECK</span><h3>Your research slip</h3></div>
     <span className="efSlipCount">{selectedRows.length} legs</span>
    </div>
    {!boardVerified&&<div className="efSlipAlert"><b>Execution gate closed</b><p>Provider coverage or freshness is not verified. This slip is research only, even if its modeled return is positive.</p></div>}
    <div className="efSlipLegs">
     {selectedRows.map((leg,i)=><div key={leg.id} className="efSlipLeg"><span>{i+1}</span><div><b>{leg.selection}</b><small>{leg.sport} · {displayOdds(leg.odds)} · {fmt(leg.simProbability)} model</small></div><button type="button" aria-label={'Remove '+leg.selection} onClick={()=>toggle(leg.id)}>×</button></div>)}
     {!selectedRows.length&&<div className="efEmpty">Select a market to begin. Each addition updates the joint-model research.</div>}
    </div>
    {conflicts.length>0&&<div className="efSlipAlert"><b>Incompatible or overlapping selections</b>{conflicts.map(x=><p key={x}>{x}</p>)}</div>}
    {result&&<div className="efSlipMetrics">
      <div className="efMajorMetric"><small>Correlation-aware joint probability</small><strong>{fmt(result.combinedProbability)}</strong><span>Modeled interval {fmt(result.jointCi[0])}–{fmt(result.jointCi[1])}</span></div>
      <div className="efSlipMetricGrid">
       <div><small>Independent estimate</small><b>{fmt(result.independentProbability)}</b></div>
       <div><small>Correlation shift</small><b>{(result.correlationDelta>=0?'+':'')+fmt(result.correlationDelta)}</b></div>
       <div><small>Illustrative combined odds</small><b>{displayOdds(result.combinedAmericanOdds)}</b></div>
       <div><small>Fair model price</small><b>{displayOdds(result.fairParlayOdds)}</b></div>
      </div>
      <div className="efQuoteNote">{sameGame?'Same-game sportsbook repricing is not provided. Multiplying leg odds is NOT an executable SGP price.':'Combined leg odds are illustrative. Confirm the actual book slip and market rules before any entry.'}</div>
      <div className="efQuoteNote">Modeled EV {experimentalEv?fmt(result.expectedValue):'Unavailable for SGP without an executable offered quote'} · {result.sameEventPairCount} same-event pair{result.sameEventPairCount===1?'':'s'} · {result.learnedPairCount} learned pair{result.learnedPairCount===1?'':'s'}</div>
      {(result.riskFlags.length>0||modelFlags.length>0)&&<details className="efModelDetails"><summary>Model and risk limitations</summary>{[...new Set([...result.riskFlags.map(x=>x.replaceAll('_',' ')),...modelFlags])].slice(0,12).map(x=><p key={x}>{x}</p>)}</details>}
     </div>}
    {selectedRows.length===1&&<div className="efEmpty">Add one more leg for a correlation-aware joint simulation.</div>}
    <div className="efSlipDecision"><b>{quoteAvailable&&result?'RESEARCH MODEL READY':'NO VERIFIED PARLAY ENTRY'}</b><p>{quoteAvailable&&result?'Model inputs pass current local checks. Book acceptance, actual combined odds, limits, liquidity and settlement remain unverified.':'The platform cannot approve this as a live parlay trade. Verify data and build an eligible slip first.'}</p></div>
    <p className="efFootnote">Joint models carry uncertainty. Simulation runs measure sampling precision, not predictive accuracy. No wagers are placed or guaranteed.</p>
   </aside>
  </div>
 </section>;
}
