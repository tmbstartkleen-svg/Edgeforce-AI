'use client';

import {useMemo} from 'react';
import type {Scanned} from '@/lib/scanner';
import {buildInstitutionalDesk} from '@/lib/institutionalDesk';
import {rankResearchPool} from '@/lib/parlayResearch';

type Props={
 rows:Scanned[];
 source:string;
 degraded:boolean;
 generatedAt?:string;
 acceptedFeeds:number;
 configuredFeeds:number;
 onNavigate:(section:'desk'|'parlays'|'board'|'games')=>void;
};
const fmt=(n:number)=>Number.isFinite(n)?(n*100).toFixed(1)+'%':'—';
const odds=(n:number)=>Number.isFinite(n)?(n>0?'+':'')+Math.round(n):'—';

export default function SportsCommandCenter({rows,source,degraded,generatedAt,acceptedFeeds,configuredFeeds,onNavigate}:Props){
 const desk=useMemo(()=>buildInstitutionalDesk({rows,source,providerDegraded:degraded,generatedAt}),[rows,source,degraded,generatedAt]);
 const boardReady=desk.boardHealthy&&acceptedFeeds>=2;
 const research=useMemo(()=>rankResearchPool(rows).slice(0,5),[rows]);
 const top=desk.today.filter(x=>x.status==='ENTRY_WINDOW').slice(0,4);
 const sportCounts=useMemo(()=>Object.entries(rows.reduce<Record<string,number>>((acc,row)=>{
  acc[row.sport]=(acc[row.sport]||0)+1;return acc;
 },{})).sort((a,b)=>b[1]-a[1]).slice(0,5),[rows]);

 return <section className="efCommandCenter" id="command" aria-label="EdgeForce command center">
  <div className="efCommandHero">
   <div>
    <div className="efKicker">EDGEFORCE AI / SPORTS MARKET OPERATING SYSTEM</div>
    <h2>The edge is in the <em>price.</em></h2>
    <p>One disciplined workspace for modeling games, detecting mispriced markets and structuring better parlays. No invented edges and no simulated certainty.</p>
    <div className="efCommandActions">
     <button type="button" onClick={()=>onNavigate('desk')}>Open Edge Scanner <span aria-hidden="true">↗</span></button>
     <button type="button" onClick={()=>onNavigate('parlays')}>Build in Parlay Lab <span aria-hidden="true">↗</span></button>
    </div>
   </div>
   <div className="efCommandFeature">
    <span>MARKET INTELLIGENCE PULSE</span>
    <strong>{boardReady?'LIVE / INDEPENDENT':'VERIFY DATA COVERAGE'}</strong>
    <p>{acceptedFeeds} of {configuredFeeds} configured feeds accepted · {desk.totalAnalyzed} scored markets in the next seven days</p>
    <div className="efPulseRail"><span style={{width:configuredFeeds>0?Math.min(100,acceptedFeeds/configuredFeeds*100)+'%':'0%'}}/></div>
    <small>{boardReady?'Live data available. Entry qualification still depends on every market’s own checks.':'Until independent source coverage and quote freshness recover, all selections are for research only.'}</small>
   </div>
  </div>

  <div className="efCommandStats">
   <article><small>Verified entry windows</small><b>{boardReady?desk.ready:0}</b><span>Conditional, not automatic wagers</span></article>
   <article><small>Research candidates</small><b>{research.length}</b><span>Ranked by model and source quality</span></article>
   <article><small>Watch / awaiting repricing</small><b>{desk.monitor}</b><span>Review before the game window</span></article>
   <article><small>Blocked / pass</small><b>{desk.passed}</b><span>Data or model checks not cleared</span></article>
  </div>
  <div className="efCommandGrid">
   <section className="efCommandPanel">
    <div className="efPanelHead"><div><span className="efKicker">TODAY / CONDITIONAL ENTRY</span><h3>Highest-confidence trade review</h3></div><button type="button" onClick={()=>onNavigate('desk')}>View all →</button></div>
    {!boardReady&&<p className="efCommandNotice">Independent provider coverage is degraded or the live board is unverified. No market is approved as an entry. Research candidates below are not picks.</p>}
    <div className="efCommandTable">
     {boardReady&&top.length>0?top.map(x=><div className="efCommandRow" key={x.id}>
      <div><b>{x.selection}</b><small>{x.sport} · {x.event}</small></div>
      <div><small>Estimated EV</small><strong>{fmt(x.expectedValue)}</strong></div>
      <div><small>Reference venue</small><strong>{x.venue}</strong></div>
      <span className="efQuality positive">VERIFY LIVE PRICE</span>
     </div>):<div className="efEmpty">No independently verified live entry currently passes the model and quote checks.</div>}
    </div>
   </section>
   <section className="efCommandPanel">
    <div className="efPanelHead"><div><span className="efKicker">PARLAY / LEG WATCH</span><h3>Foundations worth investigating</h3></div><button type="button" onClick={()=>onNavigate('parlays')}>Open lab →</button></div>
    <div className="efCommandTable">
     {research.map(({row,gate})=><div className="efWatchRow" key={row.id}>
      <div><b>{row.selection}</b><small>{row.sport} · {row.event}</small></div>
      <div><strong>{odds(row.odds)}</strong><small>{fmt(row.simProbability)} model</small></div>
      <span className="efQuality muted">{gate.eligible&&boardReady?'MODEL GATES PASS':'RESEARCH'}</span>
     </div>)}
     {!research.length&&<div className="efEmpty">No current research candidates in the received board. More markets are shown in Games & Schedules.</div>}
    </div>
   </section>
  </div>
  <div className="efCoverageStrip">
   <div><span className="efKicker">RECEIVED MARKET COVERAGE</span><p>Sport counts are based on the current board, not a claim to every league or market.</p></div>
   <div className="efSportsCoverage">{sportCounts.map(([name,count])=><span key={name}><b>{name}</b> {count}</span>)}{!sportCounts.length&&<span>Awaiting available market data</span>}</div>
   <button type="button" onClick={()=>onNavigate('games')}>Browse games →</button>
  </div>
 </section>;
}
