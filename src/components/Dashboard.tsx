'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {buildMixedSportProbabilitySet,buildProbabilitySet} from '@/lib/parlays';
import {fmtOdds,fmtPct} from '@/lib/math';
import type {Scanned} from '@/lib/scanner';
import type {RiskProfile} from '@/lib/types';

type BoardRow=Scanned & {
  dailyScore:number;
  weeklyScore:number;
  probabilityGap:number;
  calendarDay:string;
};

type PredictionContract={
  id:string;
  title:string;
  category:string;
  yesProbability:number;
  noProbability:number;
  modelProbability:number;
  probabilityDifference:number;
  volume?:number;
  expiresAt?:string;
  source:string;
};

type SummaryRow={
  key:string;
  count:number;
  hits:number;
  misses:number;
  hitRate:number;
  staked?:number;
  returned?:number;
  net?:number;
};

type LiveBoardResponse={
  generatedAt:string;
  uiRefreshMs:number;
  sourceRefreshMs:number;
  view:'today'|'week';
  limit:30|50;
  risk:RiskProfile;
  source:string;
  providerMode:string;
  providerName?:string;
  warnings?:string[];
  contextDiagnostics?:{
    matchedRows:number;
    totalRows:number;
    providers:Array<{kind:string;ok:boolean;providerId?:string;rowCount:number}>;
  };
  rows:BoardRow[];
  sports:string[];
  predictions:{
    mode:string;
    source:string|null;
    contracts:PredictionContract[];
    error?:string;
  };
  history:{
    overall:SummaryRow;
    sports:SummaryRow[];
    legCounts:SummaryRow[];
    markets:SummaryRow[];
    sampleSize:number;
  };
  historicalBets:Array<{
    id:string;
    confidence:'confirmed'|'partial';
    sport:string;
    legCount:number;
    stake:number;
    paid:number;
    result:'win'|'loss';
  }>;
  anomalies:Array<{
    id:string;
    severity:'HIGH'|'MEDIUM'|'LOW';
    sport:string;
    selection:string;
    score:number;
    reason:string;
  }>;
};

type PortfolioApiResponse={
  source:string;
  result:{
    totalStake:number;
    totalStakePct:number;
    expectedProfit:number;
    expectedRoi:number;
    positions:Array<{
      id:string;
      stake:number;
      stakePct:number;
      marginalEv:number;
      eventExposurePct:number;
      sportExposurePct:number;
      correlationExposurePct:number;
      leg:Scanned;
    }>;
    rejected:Array<{id:string;reason:string}>;
  };
};

type DbStats={
  configured:boolean;
  ok:boolean;
  counts?:{
    athletes?:number;
    player_game_stats?:number;
    market_snapshots?:number;
    model_runs?:number;
    bet_results?:number;
  };
};

const emptyBoard:LiveBoardResponse={
  generatedAt:'',
  uiRefreshMs:1000,
  sourceRefreshMs:10000,
  view:'today',
  limit:30,
  risk:'Moderate',
  source:'loading',
  providerMode:'loading',
  rows:[],
  sports:[],
  predictions:{mode:'loading',source:null,contracts:[]},
  history:{
    overall:{key:'Overall',count:0,hits:0,misses:0,hitRate:0},
    sports:[],
    legCounts:[],
    markets:[],
    sampleSize:0
  },
  historicalBets:[],
  anomalies:[]
};

function pct(n:number){return (n*100).toFixed(1)+'%'}
function money(n:number|undefined){return typeof n==='number'?'$'+n.toFixed(2):'—'}
function sourceLabel(source:string,mode:string){
  if(source==='live'&&mode==='live')return 'LIVE PROVIDER';
  if(source==='stored')return 'STORED SNAPSHOTS';
  if(source==='demo')return 'DEMO FALLBACK';
  return source.toUpperCase();
}
function dateLabel(value:string){
  if(!value)return '—';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'—':d.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}

export default function Dashboard(){
  const [view,setView]=useState<'today'|'week'>('today');
  const [limit,setLimit]=useState<30|50>(30);
  const [risk,setRisk]=useState<RiskProfile>('Moderate');
  const [board,setBoard]=useState<LiveBoardResponse>(emptyBoard);
  const [dbStats,setDbStats]=useState<DbStats>({configured:false,ok:false});
  const [sport,setSport]=useState('ALL');
  const [period,setPeriod]=useState<'ALL'|'AM'|'PM'>('ALL');
  const [market,setMarket]=useState('ALL');
  const [minSim,setMinSim]=useState(0);
  const [minOdds,setMinOdds]=useState(-1000);
  const [maxOdds,setMaxOdds]=useState(1000);
  const [parlaySize,setParlaySize]=useState(2);
  const [lastError,setLastError]=useState('');
  const [bankroll,setBankroll]=useState(1000);
  const [drawdownPct,setDrawdownPct]=useState(0);
  const [portfolio,setPortfolio]=useState<PortfolioApiResponse|null>(null);
  const busy=useRef(false);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      if(busy.current)return;
      busy.current=true;
      try{
        const res=await fetch('/api/live-board?view='+view+'&limit='+limit+'&risk='+risk,{cache:'no-store'});
        if(!res.ok)throw new Error('Board request failed');
        const json=await res.json() as LiveBoardResponse;
        if(mounted){setBoard(json);setLastError('')}
      }catch(error){
        if(mounted)setLastError(error instanceof Error?error.message:'Unable to refresh board');
      }finally{
        busy.current=false;
      }
    };
    void load();
    const timer=window.setInterval(()=>void load(),1000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[view,limit,risk]);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const res=await fetch('/api/db/stats',{cache:'no-store'});
        if(!res.ok)return;
        const json=await res.json() as DbStats;
        if(mounted)setDbStats(json);
      }catch{}
    };
    void load();
    const timer=window.setInterval(()=>void load(),30000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  useEffect(()=>{
    if(sport!=='ALL'&&!board.sports.includes(sport))setSport('ALL');
  },[board.sports,sport]);

  useEffect(()=>{
    let cancelled=false;
    const load=async()=>{
      if(!board.rows.length){setPortfolio(null);return;}
      try{
        const res=await fetch('/api/portfolio/optimize',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({bankroll,drawdownPct,risk,rows:board.rows})
        });
        if(!res.ok)return;
        const json=await res.json() as PortfolioApiResponse;
        if(!cancelled)setPortfolio(json);
      }catch{}
    };
    void load();
    return ()=>{cancelled=true};
  },[board.rows,bankroll,drawdownPct,risk]);

  const marketOptions=useMemo(()=>[...new Set(board.rows.map(x=>x.market))].sort(),[board.rows]);

  const filtered=useMemo(()=>board.rows.filter(x=>{
    if(sport!=='ALL'&&x.sport!==sport)return false;
    if(period!=='ALL'&&x.period!==period)return false;
    if(market!=='ALL'&&x.market!==market)return false;
    if(x.simProbability<minSim/100)return false;
    if(x.odds<minOdds||x.odds>maxOdds)return false;
    return true;
  }),[board.rows,sport,period,market,minSim,minOdds,maxOdds]);

  const probabilitySet=useMemo(()=>buildProbabilitySet(filtered,parlaySize),[filtered,parlaySize]);
  const mixedSet=useMemo(()=>buildMixedSportProbabilitySet(board.rows.filter(x=>x.simProbability>=minSim/100&&x.odds>=minOdds&&x.odds<=maxOdds),parlaySize),[board.rows,parlaySize,minSim,minOdds,maxOdds]);

  const amCount=filtered.filter(x=>x.period==='AM').length;
  const pmCount=filtered.filter(x=>x.period==='PM').length;
  const topGap=[...filtered].sort((a,b)=>Math.abs(b.probabilityGap)-Math.abs(a.probabilityGap)).slice(0,10);
  const predictions=[...board.predictions.contracts].sort((a,b)=>Math.abs(b.probabilityDifference)-Math.abs(a.probabilityDifference)).slice(0,12);

  return <main className="v21">
    <header className="v21Top">
      <div>
        <div className="eyebrow">EDGEFORCE AI • V23</div>
        <h1>Context-Fused Sports Probability Intelligence</h1>
        <p>Live/stored markets fused with provider weather, injuries and stats context, learned historical weights, scenario simulation, portfolio risk and history.</p>
      </div>
      <div className="v21Status">
        <span className={board.source==='live'?'dot liveDot':'dot'}/>
        <div>
          <small>{sourceLabel(board.source,board.providerMode)}</small>
          <b>{board.providerName||'Edgeforce feed'}</b>
        </div>
        <div>
          <small>UI REFRESH</small>
          <b>1 second</b>
        </div>
        <div>
          <small>DATA PULL</small>
          <b>{Math.round(board.sourceRefreshMs/1000)} sec cache</b>
        </div>
      </div>
    </header>

    {lastError&&<div className="v21Alert">{lastError}</div>}

    <section className="v21Hero">
      <div>
        <div className="badge">TOP 30 / 50 • AM / PM • 2–20 LEG FILTER • ALL LIVE SPORTS</div>
        <h2>One board for <em>probability, simulation and history.</em></h2>
        <p>The list updates every second on screen. Source pulls are cached briefly so the app stays fast without hammering upstream providers.</p>
      </div>
      <div className="v21HeroCard">
        <small>CURRENT BOARD</small>
        <strong>{filtered.length}</strong>
        <span>filtered legs</span>
        <div className="v21MiniGrid">
          <div><small>AM</small><b>{amCount}</b></div>
          <div><small>PM</small><b>{pmCount}</b></div>
          <div><small>Sports</small><b>{board.sports.length}</b></div>
          <div><small>History</small><b>{board.history.sampleSize}</b></div>
        </div>
      </div>
    </section>

    <section className="v21ControlPanel">
      <div className="controlGroup">
        <label>Board</label>
        <div className="segmented">
          <button className={view==='today'?'active':''} onClick={()=>setView('today')}>Today</button>
          <button className={view==='week'?'active':''} onClick={()=>setView('week')}>7-Day</button>
        </div>
      </div>
      <div className="controlGroup">
        <label>Rows</label>
        <div className="segmented">
          <button className={limit===30?'active':''} onClick={()=>setLimit(30)}>30</button>
          <button className={limit===50?'active':''} onClick={()=>setLimit(50)}>50</button>
        </div>
      </div>
      <div className="controlGroup">
        <label>Risk model</label>
        <select value={risk} onChange={e=>setRisk(e.target.value as RiskProfile)}>
          <option>Conservative</option>
          <option>Moderate</option>
          <option>Aggressive</option>
        </select>
      </div>
      <div className="controlGroup">
        <label>Sport</label>
        <select value={sport} onChange={e=>setSport(e.target.value)}>
          <option value="ALL">All sports</option>
          {board.sports.map(x=><option key={x}>{x}</option>)}
        </select>
      </div>
      <div className="controlGroup">
        <label>Time</label>
        <select value={period} onChange={e=>setPeriod(e.target.value as 'ALL'|'AM'|'PM')}>
          <option value="ALL">All day</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      <div className="controlGroup">
        <label>Market</label>
        <select value={market} onChange={e=>setMarket(e.target.value)}>
          <option value="ALL">All markets</option>
          {marketOptions.map(x=><option key={x}>{x}</option>)}
        </select>
      </div>
      <div className="controlGroup">
        <label>Minimum sim %</label>
        <input type="number" min="0" max="99" value={minSim} onChange={e=>setMinSim(Math.max(0,Math.min(99,Number(e.target.value)||0)))}/>
      </div>
      <div className="controlGroup double">
        <label>American odds range</label>
        <div className="rangePair">
          <input type="number" value={minOdds} onChange={e=>setMinOdds(Number(e.target.value)||-1000)}/>
          <span>to</span>
          <input type="number" value={maxOdds} onChange={e=>setMaxOdds(Number(e.target.value)||1000)}/>
        </div>
      </div>
    </section>

    <section className="v21Stats">
      <div><small>TOP SIM</small><strong>{filtered[0]?fmtPct(filtered[0].simProbability):'—'}</strong><span>{filtered[0]?.selection||'No current row'}</span></div>
      <div><small>AVG SIM</small><strong>{filtered.length?fmtPct(filtered.reduce((s,x)=>s+x.simProbability,0)/filtered.length):'—'}</strong><span>filtered board</span></div>
      <div><small>AVG MARKET</small><strong>{filtered.length?fmtPct(filtered.reduce((s,x)=>s+x.marketProb,0)/filtered.length):'—'}</strong><span>implied probability</span></div>
      <div><small>CONTEXT FUSION</small><strong>{board.contextDiagnostics?.matchedRows||0}/{board.contextDiagnostics?.totalRows||0}</strong><span>{(board.contextDiagnostics?.providers||[]).filter(x=>x.ok).length} context providers active</span></div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div>
          <div className="eyebrow">{view==='today'?'TODAY PROBABILITY BOARD':'WEEKLY SPREAD BOARD'}</div>
          <h3>{view==='today'?'Highest simulation probability first':'Probability score distributed across the week'}</h3>
        </div>
        <div className="panelMeta">
          <span>{filtered.length} shown</span>
          <span>{board.generatedAt?dateLabel(board.generatedAt):'loading'}</span>
        </div>
      </div>
      <div className="tableWrap">
        <table className="v21Table">
          <thead><tr>
            <th>#</th><th>Sport</th><th>Event / Selection</th><th>Time</th><th>Market</th><th>Odds</th><th>Market %</th><th>Sport %</th><th>Sim %</th><th>Gap</th><th>Agreement</th><th>Sims</th><th>Grade</th>
          </tr></thead>
          <tbody>
            {filtered.map((x,i)=><tr key={x.id}>
              <td className="rankCell">{i+1}</td>
              <td><span className="sportPill">{x.sport}</span></td>
              <td><b>{x.event}</b><small>{x.selection}</small></td>
              <td><b>{x.period}</b><small>{dateLabel(x.startTime)}</small></td>
              <td>{x.market}</td>
              <td>{fmtOdds(x.odds)}</td>
              <td>{fmtPct(x.marketProb)}</td>
              <td className="orange">{fmtPct(x.sportModelProbability)}</td>
              <td className="lime">{fmtPct(x.simProbability)}</td>
              <td className={x.probabilityGap>=0?'lime':'negative'}>{x.probabilityGap>=0?'+':''}{fmtPct(x.probabilityGap)}</td>
              <td>{fmtPct(x.agreement)}</td>
              <td>{x.simulationRuns.toLocaleString()}</td>
              <td><span className={'grade '+x.grade.toLowerCase()}>{x.grade}</span></td>
            </tr>)}
            {!filtered.length&&<tr><td colSpan={13} className="emptyRow">No rows match the current filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <section className="v21Grid two">
      <div className="v21Card">
        <div className="v21CardHead">
          <div><div className="eyebrow">PARLAY LEG FILTER</div><h3>Probability set</h3></div>
          <select value={parlaySize} onChange={e=>setParlaySize(Number(e.target.value))}>
            {Array.from({length:19},(_,i)=>i+2).map(n=><option value={n} key={n}>{n} legs</option>)}
          </select>
        </div>
        {probabilitySet?<div className="setBody">
          <div className="setScore"><small>COMBINED MODEL %</small><strong>{pct(probabilitySet.combinedProbability)}</strong><span>correlation adjusted</span></div>
          <div className="legList">{probabilitySet.legs.map((x,i)=><div key={x.id}><span>{i+1}</span><div><b>{x.selection}</b><small>{x.sport} • {x.market} • sim {fmtPct(x.simProbability)}</small></div></div>)}</div>
        </div>:<p className="muted">Not enough qualified rows for this leg count under the current filters.</p>}
      </div>

      <div className="v21Card">
        <div className="v21CardHead"><div><div className="eyebrow">MULTI-SPORT</div><h3>Cross-sport probability set</h3></div><span className="miniBadge">{parlaySize} legs</span></div>
        {mixedSet?<div className="setBody">
          <div className="setScore"><small>COMBINED MODEL %</small><strong>{pct(mixedSet.combinedProbability)}</strong><span>sports diversified where inventory allows</span></div>
          <div className="legList">{mixedSet.legs.map((x,i)=><div key={x.id}><span>{i+1}</span><div><b>{x.selection}</b><small>{x.sport} • {x.market} • sim {fmtPct(x.simProbability)}</small></div></div>)}</div>
        </div>:<p className="muted">Not enough rows to form this set.</p>}
      </div>
    </section>

    <section className="v21Grid two">
      <div className="v21Card">
        <div className="eyebrow">SIMULATION VS MARKET</div>
        <h3>Largest probability differences</h3>
        <div className="gapList">
          {topGap.map(x=><div key={x.id}>
            <div><b>{x.selection}</b><small>{x.sport} • {x.market}</small></div>
            <div className="gapNumbers"><span>{fmtPct(x.marketProb)}</span><b className={x.probabilityGap>=0?'lime':'negative'}>{x.probabilityGap>=0?'+':''}{fmtPct(x.probabilityGap)}</b><span>{fmtPct(x.simProbability)}</span></div>
          </div>)}
          {!topGap.length&&<p className="muted">No probability differences to display.</p>}
        </div>
      </div>

      <div className="v21Card">
        <div className="eyebrow">ANOMALY INTELLIGENCE</div>
        <h3>Signals that deserve review</h3>
        <div className="signalList">
          {board.anomalies.slice(0,10).map(x=><div key={x.id}>
            <span className={'signal '+x.severity.toLowerCase()}>{x.severity}</span>
            <div><b>{x.selection}</b><small>{x.sport} • score {pct(x.score)}</small><p>{x.reason}</p></div>
          </div>)}
          {!board.anomalies.length&&<p className="muted">No material anomaly signals in the current board.</p>}
        </div>
      </div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">PORTFOLIO RISK INTELLIGENCE</div><h3>Exposure-aware sizing with correlation and drawdown brakes</h3></div>
        <span className="miniBadge">{portfolio?.source?sourceLabel(portfolio.source,portfolio.source):'waiting for board'}</span>
      </div>
      <div className="v21ControlPanel">
        <div className="controlGroup">
          <label>Bankroll</label>
          <input type="number" min="1" value={bankroll} onChange={e=>setBankroll(Math.max(1,Number(e.target.value)||1))}/>
        </div>
        <div className="controlGroup">
          <label>Current drawdown %</label>
          <input type="number" min="0" max="100" step="0.5" value={drawdownPct*100} onChange={e=>setDrawdownPct(Math.max(0,Math.min(1,(Number(e.target.value)||0)/100)))}/>
        </div>
      </div>
      <div className="v21Stats">
        <div><small>ALLOCATED</small><strong>{portfolio?money(portfolio.result.totalStake):'—'}</strong><span>{portfolio?pct(portfolio.result.totalStakePct):'—'} of bankroll</span></div>
        <div><small>MODEL EXPECTED PROFIT</small><strong>{portfolio?money(portfolio.result.expectedProfit):'—'}</strong><span>estimate, not guaranteed</span></div>
        <div><small>MODEL EXPECTED ROI</small><strong>{portfolio?pct(portfolio.result.expectedRoi):'—'}</strong><span>based on current board inputs</span></div>
        <div><small>POSITIONS</small><strong>{portfolio?.result.positions.length||0}</strong><span>{portfolio?.result.rejected.length||0} rejected by risk limits</span></div>
      </div>
      <div className="tableWrap">
        <table className="v21Table">
          <thead><tr><th>#</th><th>Sport</th><th>Selection</th><th>Stake</th><th>Stake %</th><th>Event Exposure</th><th>Sport Exposure</th><th>Correlation</th><th>Action</th></tr></thead>
          <tbody>
            {(portfolio?.result.positions||[]).slice(0,12).map((p,i)=><tr key={p.id}>
              <td className="rankCell">{i+1}</td>
              <td><span className="sportPill">{p.leg.sport}</span></td>
              <td><b>{p.leg.selection}</b><small>{p.leg.market} • sim {fmtPct(p.leg.simProbability)}</small></td>
              <td>{money(p.stake)}</td>
              <td>{pct(p.stakePct)}</td>
              <td>{pct(p.eventExposurePct)}</td>
              <td>{pct(p.sportExposurePct)}</td>
              <td>{pct(p.correlationExposurePct)}</td>
              <td><span className="grade strong">{drawdownPct>=0.12?'REDUCE':p.correlationExposurePct>=0.04?'REDUCE':'HOLD'}</span></td>
            </tr>)}
            {!portfolio?.result.positions.length&&<tr><td colSpan={9} className="emptyRow">No qualified positions under the current risk limits.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="historyNote">Risk tags are sizing guidance from the current model and limits. They do not guarantee profit or prevent losses.</div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">PREDICTION MARKETS</div><h3>Separate probability source, side-by-side with sports markets</h3></div>
        <span className="miniBadge">{board.predictions.mode==='live'?(board.predictions.source||'live'):'provider not connected'}</span>
      </div>
      {predictions.length?<div className="predictionGrid">
        {predictions.map(x=><div className="predictionCard" key={x.id}>
          <small>{x.category}</small>
          <b>{x.title}</b>
          <div><span>Market</span><strong>{pct(x.yesProbability)}</strong></div>
          <div><span>Model</span><strong>{pct(x.modelProbability)}</strong></div>
          <div><span>Difference</span><strong className={x.probabilityDifference>=0?'lime':'negative'}>{x.probabilityDifference>=0?'+':''}{pct(x.probabilityDifference)}</strong></div>
          {x.volume!==undefined&&<small>Volume {Math.round(x.volume).toLocaleString()}</small>}
        </div>)}
      </div>:<div className="connectState">
        <b>Prediction-market adapter is ready.</b>
        <p>Set PREDICTION_PROVIDER_PRIMARY_URL and its key in Vercel to populate this section with a supported provider feed.</p>
      </div>}
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">UPLOADED RESULT HISTORY</div><h3>Observed performance by sport, leg count and market type</h3></div>
        <span className="miniBadge">{board.history.sampleSize} visible slips parsed</span>
      </div>
      <div className="historyNote">This section reports only what is visible in the uploaded screenshots. Hidden losing legs stay unknown instead of being guessed, so small samples should not be treated as a forecast.</div>
      <div className="historyGrid">
        <div className="historyBox">
          <h4>By sport</h4>
          {board.history.sports.map(x=><div className="historyRow" key={x.key}><span>{x.key}</span><b>{pct(x.hitRate)}</b><small>{x.hits}-{x.misses} • net {money(x.net)}</small></div>)}
        </div>
        <div className="historyBox">
          <h4>By parlay size</h4>
          {board.history.legCounts.map(x=><div className="historyRow" key={x.key}><span>{x.key} legs</span><b>{pct(x.hitRate)}</b><small>{x.hits}-{x.misses} • net {money(x.net)}</small></div>)}
        </div>
        <div className="historyBox">
          <h4>Known leg outcomes by market</h4>
          {board.history.markets.map(x=><div className="historyRow" key={x.key}><span>{x.key}</span><b>{pct(x.hitRate)}</b><small>{x.hits}-{x.misses} known legs</small></div>)}
        </div>
      </div>
    </section>

    <section className="v21FooterGrid">
      <div><small>ATHLETES</small><b>{dbStats.counts?.athletes||0}</b></div>
      <div><small>PLAYER GAME STATS</small><b>{dbStats.counts?.player_game_stats||0}</b></div>
      <div><small>MARKET SNAPSHOTS</small><b>{dbStats.counts?.market_snapshots||0}</b></div>
      <div><small>MODEL RUNS</small><b>{dbStats.counts?.model_runs||0}</b></div>
      <div><small>SETTLED RESULTS</small><b>{dbStats.counts?.bet_results||0}</b></div>
    </section>
  </main>;
}
