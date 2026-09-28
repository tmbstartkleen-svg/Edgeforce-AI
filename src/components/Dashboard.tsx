'use client';
import {useMemo,useState} from 'react';
import {demoMarkets} from '@/lib/demo';
import {top30} from '@/lib/engine';
import {fmtOdds,fmtPct} from '@/lib/math';
import type {RiskProfile} from '@/lib/types';

export default function Dashboard(){
 const [risk,setRisk]=useState<RiskProfile>('Moderate');
 const ranked=useMemo(()=>top30(demoMarkets,risk),[risk]);
 return <main>
  <header className="topbar"><div><div className="eyebrow">EDGEFORCE AI</div><h1>Sports Probability Intelligence Terminal</h1></div><div className="live"><span/>MODEL ONLINE <b>V4</b></div></header>
  <section className="hero"><div><div className="badge">EV-FIRST • MODEL COUNCIL • KELLY</div><h2>Find the price the market <em>misunderstands.</em></h2><p>DraftKings-style odds are treated as market prices. Edgeforce independently estimates probability, fair odds, expected value, agreement, and risk-sized exposure.</p></div>
  <aside className="goal"><small>DAILY GAIN GOAL</small><strong>30%</strong><label>Risk profile <select value={risk} onChange={e=>setRisk(e.target.value as RiskProfile)}><option>Conservative</option><option>Moderate</option><option>Aggressive</option></select></label><p>Target only. The engine can return NO BET when nothing qualifies.</p></aside></section>
  <section className="stats">
   <div className="stat"><small>QUALIFIED LEGS</small><strong>{ranked.length}</strong><span>Top 30 pipeline</span></div>
   <div className="stat"><small>ELITE SIGNALS</small><strong>{ranked.filter(x=>x.grade==='ELITE').length}</strong><span>High-confidence EV</span></div>
   <div className="stat"><small>AVG AGREEMENT</small><strong>{fmtPct(ranked.reduce((s,x)=>s+x.agreement,0)/Math.max(1,ranked.length))}</strong><span>Model council</span></div>
   <div className="stat"><small>HORIZON</small><strong>8 DAYS</strong><span>Provider-ready</span></div>
  </section>
  <section className="panel"><div className="panelHead"><div><div className="eyebrow">TODAY'S TOP 30</div><h3>Ranked by executable expected value</h3></div></div>
   <div className="tableWrap"><table><thead><tr><th>#</th><th>Sport</th><th>Event / Selection</th><th>Odds</th><th>Market</th><th>AI</th><th>Edge</th><th>EV</th><th>Fair</th><th>Kelly</th><th>Agreement</th><th>Grade</th></tr></thead>
   <tbody>{ranked.map((x,i)=><tr key={x.id}><td>{i+1}</td><td>{x.sport}</td><td><b>{x.event}</b><small>{x.selection}</small></td><td>{fmtOdds(x.odds)}</td><td>{fmtPct(x.marketProb)}</td><td className={x.edge>.06?'orange':'lime'}>{fmtPct(x.modelProb)}</td><td className="lime">+{fmtPct(x.edge)}</td><td className="lime">{fmtPct(x.expectedValue)}</td><td>{fmtOdds(x.fairOdds)}</td><td>{fmtPct(x.recommendedStake)}</td><td>{fmtPct(x.agreement)}</td><td><span className={'grade '+x.grade.toLowerCase()}>{x.grade}</span></td></tr>)}</tbody></table></div>
  </section>
  <section className="grid"><div className="card"><div className="eyebrow">MODEL COUNCIL</div><h3>9 independent probability views</h3><p>Market No-Vig, Elo/Power, Bayesian, Monte Carlo, Matchup, Player/Usage, Environment, Line Regime, Historical Analog.</p></div>
  <div className="card"><div className="eyebrow">NEXT</div><h3>Live scanner + historical learning</h3><p>Authorized odds ingestion, player database, injury/weather repricing, CLV memory, and walk-forward backtests will feed this ranking layer.</p></div></section>
 </main>
}