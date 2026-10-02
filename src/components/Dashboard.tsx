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

type ParlayRow={
  id:string;
  legs:BoardRow[];
  combinedProbability:number;
  independentProbability:number;
  correlationPenalty:number;
  correlationDelta:number;
  jointHits:number;
  jointRuns:number;
  jointMode:'shared-monte-carlo'|'estimated';
  estimatedAmericanOdds:number;
  simFairAmericanOdds:number;
  priceVerified:boolean;
  sportsbookImpliedProbability:number;
  edge:number;
  quarterKelly:number;
  score:number;
  label:string;
};

type WeeklyDraft={
  configured:boolean;
  week:string;
  legs:Array<{
    marketId:string;
    sport:string;
    event:string;
    selection:string;
    market:string;
    startTime:string;
    odds:number;
    simProbability:number;
    originalOdds:number;
    originalSimProbability:number;
    currentOdds:number;
    currentSimProbability:number;
    locked:boolean;
    needsReview:boolean;
    changeSummary:string[];
  }>;
  combinedProbability:number|null;
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
  minJoint:number;
  minLeg:number;
  rows:BoardRow[];
  sports:string[];
  parlays:{
    topTwoLeg:ParlayRow[];
    topThreeLeg:ParlayRow[];
    valueTwoLeg:ParlayRow[];
  };
  coverage:{
    markets:number;
    noVigComplete:number;
    predictionMatched:number;
    projectedProps:number;
    fallbackSims:number;
    jointMonteCarloParlays:number;
  };
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

type LearningDashboard={
  configured:boolean;
  latestRun:null|{
    id:number;modelVersion:string;status:string;sampleSize:number;brierScore:number;logLoss:number;
    calibrationError:number;roi:number;avgClv:number;periodStart:string;periodEnd:string;createdAt:string;
  };
  bands:Array<{bandLabel:string;minProbability:number;maxProbability:number;sampleSize:number;predictedAverage:number;hitRate:number;brierScore:number;roi:number;avgClv:number}>;
  rankings:Array<{modelName:string;sport:string;marketKey:string;sampleSize:number;decayedScore:number;confidenceLabel:string;brierScore:number;roi:number;avgClv:number;calibrationError:number}>;
  props:Array<{sport:string;propType:string;sampleSize:number;predictedAverage:number;hitRate:number;brierScore:number;roi:number;avgClv:number;calibrationError:number}>;
  error?:string;
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
  minJoint:.52,
  minLeg:.65,
  rows:[],
  sports:[],
  parlays:{topTwoLeg:[],topThreeLeg:[],valueTwoLeg:[]},
  coverage:{markets:0,noVigComplete:0,predictionMatched:0,projectedProps:0,fallbackSims:0,jointMonteCarloParlays:0},
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
  const limit:30=30;
  const [risk,setRisk]=useState<RiskProfile>('Moderate');
  const [board,setBoard]=useState<LiveBoardResponse>(emptyBoard);
  const [dbStats,setDbStats]=useState<DbStats>({configured:false,ok:false});
  const [learning,setLearning]=useState<LearningDashboard>({configured:false,latestRun:null,bands:[],rankings:[],props:[]});
  const [sport,setSport]=useState('ALL');
  const [period,setPeriod]=useState<'ALL'|'AM'|'PM'>('ALL');
  const [market,setMarket]=useState('ALL');
  const [minSim,setMinSim]=useState(65);
  const [minJoint,setMinJoint]=useState(52);
  const [minOdds,setMinOdds]=useState(-1000);
  const [maxOdds,setMaxOdds]=useState(1000);
  const [parlaySize,setParlaySize]=useState(2);
  const [lastError,setLastError]=useState('');
  const [weekly,setWeekly]=useState<WeeklyDraft>({configured:false,week:'',legs:[],combinedProbability:null});
  const [weeklyMessage,setWeeklyMessage]=useState('');
  const busy=useRef(false);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      if(busy.current)return;
      busy.current=true;
      try{
        const res=await fetch('/api/live-board?view='+view+'&risk='+risk+'&minJoint='+(minJoint/100),{cache:'no-store'});
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
    const timer=window.setInterval(()=>void load(),5000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[view,risk,minJoint]);

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
    let mounted=true;
    const loadLearning=async()=>{
      try{
        const res=await fetch('/api/learning',{cache:'no-store'});
        if(!res.ok)return;
        const json=await res.json() as LearningDashboard;
        if(mounted)setLearning(json);
      }catch{}
    };
    void loadLearning();
    const timer=window.setInterval(()=>void loadLearning(),60000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  useEffect(()=>{
    if(sport!=='ALL'&&!board.sports.includes(sport))setSport('ALL');
  },[board.sports,sport]);

  useEffect(()=>{
    let mounted=true;
    const loadWeekly=async()=>{
      try{
        const res=await fetch('/api/weekly-builder',{cache:'no-store'});
        if(!res.ok)return;
        const json=await res.json() as WeeklyDraft;
        if(mounted)setWeekly(json);
      }catch{}
    };
    void loadWeekly();
    const timer=window.setInterval(()=>void loadWeekly(),15000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  const addWeeklyLeg=async(row:BoardRow)=>{
    try{
      const res=await fetch('/api/weekly-builder',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'add',row})
      });
      const json=await res.json();
      if(!res.ok||!json.ok){setWeeklyMessage(json.error||'Unable to add leg');return}
      setWeeklyMessage('Added to weekly builder');
      const refreshed=await fetch('/api/weekly-builder',{cache:'no-store'});
      if(refreshed.ok)setWeekly(await refreshed.json() as WeeklyDraft);
    }catch{setWeeklyMessage('Unable to update weekly builder')}
  };

  const updateWeeklyLeg=async(marketId:string,action:'remove'|'lock'|'unlock')=>{
    try{
      const res=await fetch('/api/weekly-builder',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({action,marketId})
      });
      const json=await res.json();
      if(!res.ok||!json.ok){setWeeklyMessage(json.error||'Unable to update leg');return}
      const refreshed=await fetch('/api/weekly-builder',{cache:'no-store'});
      if(refreshed.ok)setWeekly(await refreshed.json() as WeeklyDraft);
      setWeeklyMessage(action==='remove'?'Removed weekly leg':action==='lock'?'Locked weekly leg':'Unlocked weekly leg');
    }catch{setWeeklyMessage('Unable to update weekly builder')}
  };


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
        <div className="eyebrow">EDGEFORCE AI • V25</div>
        <h1>Live Sports Probability Intelligence</h1>
        <p>Automated DraftKings odds, no-vig probabilities, prediction markets, shared-outcome 10,000-run Monte Carlo parlays and a persistent weekly builder. <a href="/pregame">Open V25 Pregame Monitor</a></p>
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
        <div className="badge">TOP 30 PICKS • 30 TWO-LEG PARLAYS • 65%+ LEGS • 52%+ JOINT • 10K MONTE CARLO</div>
        <h2>Daily and weekly <em>65%+ simulation legs with 52%+ combined tickets.</em></h2>
        <p>Each board shows up to 30 qualified legs. Every official parlay uses the same 10,000 simulated outcomes behind its legs to measure the actual joint hit rate. Weekly tickets spread legs across different calendar days, and probability-fallback legs are excluded.</p>
      </div>
      <div className="v21HeroCard">
        <small>CURRENT BOARD</small>
        <strong>{filtered.length}</strong>
        <span>filtered legs</span>
        <div className="v21MiniGrid">
          <div><small>AM</small><b>{amCount}</b></div>
          <div><small>PM</small><b>{pmCount}</b></div>
          <div><small>Sports</small><b>{board.sports.length}</b></div>
          <div><small>Pred matched</small><b>{board.coverage.predictionMatched}</b></div>
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
        <label>Minimum leg sim %</label>
        <input type="number" min="65" max="99" value={minSim} onChange={e=>setMinSim(Math.max(65,Math.min(99,Number(e.target.value)||65)))}/>
      </div>
      <div className="controlGroup">
        <label>Minimum joint %</label>
        <input type="number" min="52" max="99" value={minJoint} onChange={e=>setMinJoint(Math.max(52,Math.min(99,Number(e.target.value)||52)))}/>
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
      <div><small>TRUE JOINT MC</small><strong>{board.coverage.jointMonteCarloParlays}</strong><span>qualifying two-leg tickets • 10,000 trials</span></div>
      <div><small>DATABASE</small><strong>{dbStats.ok?'ONLINE':dbStats.configured?'CHECK':'LOCAL'}</strong><span>{dbStats.counts?.athletes||0} athletes • {dbStats.counts?.player_game_stats||0} stat rows</span></div>
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
            <th>#</th><th>Sport</th><th>Event / Selection</th><th>Time</th><th>Market</th><th>Odds</th><th>Raw %</th><th>No-vig %</th><th>Pred %</th><th>Sport %</th><th>Sim %</th><th>Edge</th><th>¼ Kelly</th><th>Sims</th><th>Grade</th><th>Week</th>
          </tr></thead>
          <tbody>
            {filtered.map((x,i)=><tr key={x.id}>
              <td className="rankCell">{i+1}</td>
              <td><span className="sportPill">{x.sport}</span></td>
              <td><b>{x.event}</b><small>{x.selection}</small></td>
              <td><b>{x.period}</b><small>{dateLabel(x.startTime)}</small></td>
              <td>{x.market}</td>
              <td>{fmtOdds(x.odds)}</td>
              <td>{fmtPct(x.rawImpliedProb??x.marketProb)}</td>
              <td>{fmtPct(x.noVigProb??x.marketProb)}</td>
              <td>{typeof x.predictionProb==='number'?fmtPct(x.predictionProb):'—'}</td>
              <td className="orange">{fmtPct(x.sportModelProbability)}</td>
              <td className="lime">{fmtPct(x.simProbability)}</td>
              <td className={x.edge>=0?'lime':'negative'}>{x.edge>=0?'+':''}{fmtPct(x.edge)}</td>
              <td>{fmtPct(x.quarterKelly)}</td>
              <td>{x.simulationRuns.toLocaleString()}</td>
              <td><span className={'grade '+x.grade.toLowerCase()}>{x.grade}</span></td>
              <td><button className="tinyAction" onClick={()=>void addWeeklyLeg(x)}>Add</button></td>
            </tr>)}
            {!filtered.length&&<tr><td colSpan={16} className="emptyRow">No rows match the current filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>


    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">{view==='today'?'DAILY PARLAY ENGINE':'WEEKLY STRETCHED PARLAYS'}</div><h3>{view==='today'?'Up to 30 two-leg tickets from 65%+ Monte Carlo legs':'Up to 30 two-leg tickets using legs on different days'}</h3></div>
        <div className="panelMeta"><span>Legs 65%+</span><span>Joint {minJoint}%+</span><span>Max leg reuse 2×</span></div>
      </div>
      <div className="parlayCards">
        {board.parlays.topTwoLeg.map((p,i)=><div className="parlayCard" key={p.id}>
          <div className="parlayCardTop"><span>#{i+1} • 2-LEG • {p.jointMode==='shared-monte-carlo'?'TRUE JOINT MC':'ESTIMATED'}</span><strong>{pct(p.combinedProbability)}</strong></div>
          <div className="parlayLegs">{p.legs.map((x,n)=><div key={x.id}><b>{n+1}. {x.selection}</b><small>{x.sport} • {x.market} • {fmtOdds(x.odds)} • sim {fmtPct(x.simProbability)}</small></div>)}</div>
          <div className="parlayMeta"><span>Joint sims {p.jointHits.toLocaleString()}/{p.jointRuns.toLocaleString()}</span><span>Sim fair {fmtOdds(p.simFairAmericanOdds)}</span><span>Calc. book {fmtOdds(p.estimatedAmericanOdds)}</span><span>Edge {p.edge>=0?'+':''}{pct(p.edge)}</span><span>¼ Kelly {pct(p.quarterKelly)}</span><span>Corr Δ {p.correlationDelta>=0?'+':''}{pct(p.correlationDelta)}</span></div>
        </div>)}
        {!board.parlays.topTwoLeg.length&&<div className="connectState"><b>No qualifying two-leg parlays.</b><p>No ticket is forced below 65% per leg and the selected 52%+ joint-probability floor.</p></div>}
      </div>
      <div className="v22ParlaySplit">
        <div>
          <div className="subHead">VALUE TWO-LEG • 65%+ EACH</div>
          {board.parlays.valueTwoLeg.slice(0,5).map(p=><div className="miniParlay" key={'v-'+p.id}><b>{p.legs.map(x=>x.selection).join(' + ')}</b><span>{pct(p.combinedProbability)} joint • {p.edge>=0?'+':''}{pct(p.edge)} edge</span></div>)}
        </div>
        <div>
          <div className="subHead">QUALIFYING THREE-LEG • 52%+ JOINT</div>
          {board.parlays.topThreeLeg.slice(0,5).map(p=><div className="miniParlay" key={'t-'+p.id}><b>{p.legs.map(x=>x.selection).join(' + ')}</b><span>{pct(p.combinedProbability)} joint • ¼ Kelly {pct(p.quarterKelly)}</span></div>)}
        </div>
      </div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">WEEKLY PARLAY BUILDER</div><h3>Build the week gradually and lock legs you want to preserve</h3></div>
        <div className="panelMeta"><span>{weekly.week||'current week'}</span><span>{weekly.combinedProbability!==null?pct(weekly.combinedProbability):'—'} joint</span></div>
      </div>
      {weeklyMessage&&<div className="historyNote">{weeklyMessage}</div>}
      <div className="weeklyBuilder">
        {weekly.legs.map((x,i)=><div className="weeklyLeg" key={x.marketId}>
          <span className="rankCell">{i+1}</span>
          <div><b>{x.selection}</b><small>{x.sport} • {x.event} • {x.market} • saved {fmtOdds(x.odds)} / {pct(x.simProbability)} • current {fmtOdds(x.currentOdds)} / {pct(x.currentSimProbability)}</small>{x.needsReview&&<small className="negative">{x.changeSummary.length?x.changeSummary.join(' • '):'Current simulation fell below the saved threshold'}</small>}</div>
          <div className="weeklyActions">
            {x.needsReview&&<span className="signal high">REVIEW</span>}<span className={x.locked?'locked':'unlocked'}>{x.locked?'LOCKED':'OPEN'}</span>
            <button onClick={()=>void updateWeeklyLeg(x.marketId,x.locked?'unlock':'lock')}>{x.locked?'Unlock':'Lock'}</button>
            <button disabled={x.locked} onClick={()=>void updateWeeklyLeg(x.marketId,'remove')}>Remove</button>
          </div>
        </div>)}
        {!weekly.legs.length&&<div className="connectState"><b>No weekly legs yet.</b><p>Use the Add button on any daily or weekly board row to start building the ticket.</p></div>}
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
          <div className="setScore"><small>COMBINED MODEL %</small><strong>{pct(probabilitySet.combinedProbability)}</strong><span>{probabilitySet.jointMode==='shared-monte-carlo'?'shared Monte Carlo':'estimated set'}</span></div>
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
        <div><div className="eyebrow">AUTOMATED MODEL LEARNING</div><h3>How the 65%+ simulation bands perform after settlement</h3></div>
        <div className="panelMeta"><span>{learning.latestRun?learning.latestRun.sampleSize+' settled samples':'Awaiting settled samples'}</span><span>{learning.latestRun?dateLabel(learning.latestRun.createdAt):'—'}</span></div>
      </div>
      {learning.latestRun?<div>
        <div className="v21Stats">
          <div><small>BRIER SCORE</small><strong>{learning.latestRun.brierScore.toFixed(3)}</strong><span>lower is better</span></div>
          <div><small>CALIBRATION ERROR</small><strong>{pct(learning.latestRun.calibrationError)}</strong><span>predicted vs actual</span></div>
          <div><small>UNIT ROI</small><strong>{learning.latestRun.roi>=0?'+':''}{pct(learning.latestRun.roi)}</strong><span>model-run backtest</span></div>
          <div><small>AVG CLV</small><strong>{learning.latestRun.avgClv>=0?'+':''}{pct(learning.latestRun.avgClv)}</strong><span>closing-line movement</span></div>
        </div>
        <div className="historyGrid">
          <div className="historyBox"><h4>Probability-band calibration</h4>
            {learning.bands.map(x=><div className="historyRow" key={x.bandLabel}><span>{x.bandLabel}%</span><b>{x.sampleSize?pct(x.hitRate):'—'}</b><small>{x.sampleSize} samples • predicted {x.sampleSize?pct(x.predictedAverage):'—'} • ROI {x.sampleSize?pct(x.roi):'—'}</small></div>)}
          </div>
          <div className="historyBox"><h4>Rolling model confidence</h4>
            {learning.rankings.slice(0,8).map(x=><div className="historyRow" key={x.modelName+'|'+x.sport+'|'+x.marketKey}><span>{x.sport} • {x.marketKey}</span><b>{x.confidenceLabel}</b><small>{x.sampleSize} samples • score {pct(x.decayedScore)} • cal error {pct(x.calibrationError)}</small></div>)}
            {!learning.rankings.length&&<p className="muted">Rankings will populate as settled model runs accumulate.</p>}
          </div>
          <div className="historyBox"><h4>Player-prop performance</h4>
            {learning.props.slice(0,10).map(x=><div className="historyRow" key={x.sport+'|'+x.propType}><span>{x.sport} • {x.propType.replaceAll('_',' ')}</span><b>{x.sampleSize?pct(x.hitRate):'—'}</b><small>{x.sampleSize} samples • predicted {x.sampleSize?pct(x.predictedAverage):'—'} • ROI {x.sampleSize?pct(x.roi):'—'} • CLV {x.sampleSize?pct(x.avgClv):'—'}</small></div>)}
            {!learning.props.length&&<p className="muted">Player-prop learning will populate after stat-result settlement begins.</p>}
          </div>
        </div>
      </div>:<div className="connectState"><b>Automatic settlement and calibration are ready.</b><p>After the V23 database migration is applied and completed-event results are available, Edgeforce will grade runs and measure the 65–69%, 70–74%, 75–79%, 80–84%, 85–89% and 90%+ probability bands automatically.</p></div>}
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
