'use client';
import {useMemo,useState} from 'react';
import {demoMarkets} from '@/lib/demo';
import {todayTop30,weekTop30} from '@/lib/scanner';
import {buildParlays} from '@/lib/parlays';
import {fmtOdds,fmtPct} from '@/lib/math';
import LiveConsole from '@/components/LiveConsole';
import type {RiskProfile} from '@/lib/types';

export default function Dashboard(){
 const [risk,setRisk]=useState<RiskProfile>('Moderate');
 const [view,setView]=useState<'today'|'week'>('today');
 const ranked=useMemo(()=>view==='today'?todayTop30(demoMarkets,risk):weekTop30(demoMarkets,risk),[risk,view]);
 const am=ranked.filter(x=>x.period==='AM');
 const pm=ranked.filter(x=>x.period==='PM');
 const p2=useMemo(()=>buildParlays(weekTop30(demoMarkets,risk),2),[risk]);
 const p3=useMemo(()=>buildParlays(weekTop30(demoMarkets,risk),3),[risk]);
 return <main>
  <header className="topbar"><div><div className="eyebrow">EDGEFORCE AI</div><h1>Sports Probability Intelligence Terminal</h1></div><div className="live"><span/>PRODUCTION QUALITY GATE <b>V14</b></div></header>
  <section className="hero"><div><div className="badge">DATA QUALITY • PROVIDER HEALTH • FAILOVER • DEPLOY TESTS</div><h2>Every signal. <em>Trusted before it ranks.</em></h2><p>Edgeforce now scores source freshness, completeness, provider agreement, lineup certainty, and duplicate risk before a market can become actionable.</p></div>
   <aside className="goal"><small>DAILY GAIN GOAL</small><strong>30%</strong><label>Risk profile <select value={risk} onChange={e=>setRisk(e.target.value as RiskProfile)}><option>Conservative</option><option>Moderate</option><option>Aggressive</option></select></label><p>Moderate remains the default. This is a target, not a forced return.</p></aside>
  </section>
  <section className="stats">
   <div className="stat"><small>SPORT ENGINES</small><strong>11</strong><span>NFL through Golf</span></div>
   <div className="stat"><small>QUALIFIED</small><strong>{ranked.length}</strong><span>{view==='today'?'Today':'8-day horizon'}</span></div>
   <div className="stat"><small>ELITE</small><strong>{ranked.filter(x=>x.grade==='ELITE').length}</strong><span>EV + agreement + sport model</span></div>
   <div className="stat"><small>MAX SIMS</small><strong>{Math.max(0,...ranked.map(x=>x.simulationRuns)).toLocaleString()}</strong><span>Adaptive per market</span></div>
  </section>

  <LiveConsole/>

  <nav className="tabs"><button className={view==='today'?'active':''} onClick={()=>setView('today')}>TODAY TOP 30</button><button className={view==='week'?'active':''} onClick={()=>setView('week')}>WEEK TOP 30</button></nav>

  <section className="split">
   <div className="card"><div className="eyebrow">AM CARD</div><h3>{am.length} qualified legs</h3><p>{am.slice(0,3).map(x=>x.selection).join(' • ')||'No AM legs currently qualify.'}</p></div>
   <div className="card"><div className="eyebrow">PM CARD</div><h3>{pm.length} qualified legs</h3><p>{pm.slice(0,3).map(x=>x.selection).join(' • ')||'No PM legs currently qualify.'}</p></div>
  </section>

  <section className="panel"><div className="panelHead"><div><div className="eyebrow">{view==='today'?"TODAY'S TOP 30":"WEEKLY TOP 30"}</div><h3>Market vs sport model vs ensemble probability</h3></div></div>
   <div className="tableWrap"><table><thead><tr><th>#</th><th>Sport</th><th>Event / Selection</th><th>Odds</th><th>Market P</th><th>Sport P</th><th>Sim P</th><th>Edge</th><th>EV</th><th>Fair</th><th>Sims</th><th>Factors</th><th>Grade</th></tr></thead>
   <tbody>{ranked.map((x,i)=><tr key={x.id}><td>{i+1}</td><td>{x.sport}</td><td><b>{x.event}</b><small>{x.selection}</small></td><td>{fmtOdds(x.odds)}</td><td>{fmtPct(x.marketProb)}</td><td className="orange">{fmtPct(x.sportModelProbability)}</td><td className="lime">{fmtPct(x.simProbability)}</td><td className="lime">+{fmtPct(x.edge)}</td><td className="lime">{fmtPct(x.expectedValue)}</td><td>{fmtOdds(x.fairOdds)}</td><td>{x.simulationRuns.toLocaleString()}</td><td><small>{x.sportFactors.join(' • ')||'Neutral'}</small></td><td><span className={'grade '+x.grade.toLowerCase()}>{x.grade}</span></td></tr>)}</tbody></table></div>
  </section>

  <section className="parlayGrid">
   <div className="card"><div className="eyebrow">2-LEG ELITE</div><h3>Correlation-adjusted combinations</h3>{p2.slice(0,3).map(p=><div className="parlay" key={p.id}><b>{p.legs.map(x=>x.selection).join(' + ')}</b><span>{fmtPct(p.combinedProbability)} combined • penalty {fmtPct(p.correlationPenalty)}</span></div>)}</div>
   <div className="card"><div className="eyebrow">3-LEG ELITE</div><h3>Higher payout, controlled overlap</h3>{p3.slice(0,3).map(p=><div className="parlay" key={p.id}><b>{p.legs.map(x=>x.selection).join(' + ')}</b><span>{fmtPct(p.combinedProbability)} combined • penalty {fmtPct(p.correlationPenalty)}</span></div>)}</div>
  </section>
 </main>
}