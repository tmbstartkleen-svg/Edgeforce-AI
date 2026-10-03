'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {buildMixedSportProbabilitySet,buildProbabilitySet} from '@/lib/parlays';
import {fmtOdds,fmtPct} from '@/lib/math';
import type {Scanned} from '@/lib/scanner';
import type {RiskProfile} from '@/lib/types';
import type {LearnedSgpMap} from '@/lib/learnedSgpCorrelation';
import MarketDrilldown from './MarketDrilldown';

type BoardRow=Scanned & {
  dailyScore:number;
  weeklyScore:number;
  probabilityGap:number;
  calendarDay:string;
  rawImpliedProbability:number;
  noVigProbability:number;
  sportsbookEdge:number;
  quarterKelly:number;
  predictionMarketProbability?:number;
  predictionMarketVolume?:number;
  predictionMarketSource?:string;
  predictionMarketTitle?:string;
  predictionMarketStatus:'MATCHED'|'ILLIQUID'|'UNKNOWN_LIQUIDITY'|'NO_MATCH';
  predictionEdge?:number;
  lineMovement?:{
    openerOdds:number;
    currentOdds:number;
    openerProbability:number;
    currentProbability:number;
    probabilityMove:number;
    oddsMove:number;
    snapshotCount:number;
    direction:'TOWARD'|'AWAY'|'FLAT';
    steam:boolean;
    steamStrength:'NONE'|'WATCH'|'STRONG';
  }|null;
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
  pushes?:number;
  pending?:number;
  hitRate:number;
  staked?:number;
  returned?:number;
  net?:number;
  roi?:number;
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
  providerDegraded?:boolean;
  providerQuality?:{grade:string;qualityScore:number;rowCount:number;payloadAgeMin?:number}|null;
  providerAttempts?:Array<{providerId:string;ok:boolean;skipped?:boolean;circuitState?:string;qualityGrade?:string;qualityScore?:number;error?:string}>;
  targetBook?:string;
  providerPanel?:Array<{
    providerId:string;providerName:string;bookmaker:string;marketRole:string;
    configuredWeight:number;effectiveWeight:number;acceptedMarkets:number;
    qualityGrade?:string;qualityScore?:number;
  }>;
  consensusCoverage?:{
    targetBook:string;configuredFeeds:number;acceptedFeeds:number;rows:number;multiBookRows:number;
    targetBookRows:number;averageAgreement:number;averageDispersion:number;priceShopOpportunities:number;
    outlierRows:number;classifiedRows:number;sharpOverPublic:number;publicOverSharp:number;aligned:number;
  };
  dynamicCalibrationProfileCount?:number;
  regimeCoverage?:{
    stable:number;volatile:number;dislocated:number;thin:number;unknown:number;
    highConfidence:number;mediumConfidence:number;lowConfidence:number;averageDynamicConfidence:number;
  };
  warnings?:string[];
  contextRevision?:string;
  contextChanges?:Array<{
    id:string;
    marketId:string;
    event:string;
    selection:string;
    sport:string;
    type:string;
    severity:'INFO'|'WATCH'|'ACTION';
    reason:string;
    detectedAt:string;
  }>;
  resimulationTriggered?:boolean;
  resimulatedMarketIds?:string[];
  resimulationResults?:Array<{
    marketId:string;
    selection:string;
    simProbability:number;
    modelProbability:number;
    expectedValue:number;
    grade:string;
    simEngine:string;
  }>;
  contextDiagnostics?:{
    matchedRows:number;
    totalRows:number;
    providers:Array<{kind:string;ok:boolean;providerId?:string;rowCount:number}>;
  };
  rows:BoardRow[];
  sports:string[];
  learnedSgpCorrelations?:LearnedSgpMap;
  learnedSgpProfileCount?:number;
  predictions:{
    mode:string;
    source:string|null;
    contracts:PredictionContract[];
    error?:string;
  };
  steamCount?:number;
  predictionCoverage?:{
    minimumVolume:number;
    matched:number;
    illiquid:number;
    unknownLiquidity:number;
    unmatched:number;
  };
  history:{
    overall:SummaryRow;
    sports:SummaryRow[];
    legCounts:SummaryRow[];
    markets:SummaryRow[];
    legSports?:SummaryRow[];
    probabilityBands?:SummaryRow[];
    sampleSize:number;
    settledCount?:number;
    pendingCount?:number;
    avgModelWinner?:number;
    avgModelLoser?:number;
    bestSport?:string;
    bestParlaySize?:string;
  };
  historicalBets:Array<{
    id:string;
    confidence:'confirmed'|'partial';
    sport:string;
    legCount:number;
    stake:number;
    paid:number;
    result:'win'|'loss'|'push'|'open';
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
    drawdownBrake:number;
    stressScale:number;
    stress:{
      runsPerScenario:number;
      drawdownLimitPct:number;
      worstScenario:{
        scenario:string;meanPnl:number;var95Loss:number;cvar95Loss:number;maxLoss:number;
        probabilityOfLoss:number;drawdownBreachProbability:number;volatility:number;
      };
      baseScenario:{
        scenario:string;meanPnl:number;var95Loss:number;cvar95Loss:number;maxLoss:number;
        probabilityOfLoss:number;drawdownBreachProbability:number;volatility:number;
      };
      scenarios:Array<{
        scenario:string;meanPnl:number;p05:number;p10:number;p50:number;p90:number;p95:number;
        var95Loss:number;cvar95Loss:number;maxLoss:number;probabilityOfLoss:number;
        drawdownBreachProbability:number;volatility:number;runs:number;
      }>;
    };
  };
};

type ModelDiagnosticsResponse={
  ok:boolean;
  source:string;
  sampleSize:number;
  summary:{
    fragility:{robust:number;moderate:number;fragile:number};
    averageAgreement:number;
    averageEffectiveModelCount:number;
    averageWeightConcentration:number;
    averageAbsoluteEdge:number;
    dominantModels:Array<{name:string;count:number}>;
  };
  mostFragile:Array<{
    market:{id:string;sport:string;event:string;selection:string;market:string};
    explanation:{edge:number;diagnostics:{fragility:string;fragilityRatio:number;dominantModel:string;dominantWeight:number;councilAgreement:number}};
  }>;
};

type ReleaseCertificationResponse={
  ok:boolean;
  latest?:{
    id:number;
    releaseVersion:string;
    modelVersion:string;
    commitSha?:string|null;
    environment:string;
    certified:boolean;
    blockers?:string[];
    warnings?:string[];
    createdAt:string;
  }|null;
};

type AutomationHealthResponse={
  ok:boolean;
  source:string;
  healthy:boolean;
  healthyCount:number;
  pendingCount:number;
  failedCount:number;
  staleCount:number;
  blockers:string[];
  warnings:string[];
  jobs:Array<{
    jobName:string;
    state:'HEALTHY'|'STALE'|'FAILED'|'PENDING';
    lastRun?:string|null;
    ageHours?:number|null;
    status?:string|null;
  }>;
};

type DataQualityResponse={
  ok:boolean;
  source:string;
  providerId?:string|null;
  audit:{
    score:number;
    grade:'TRUSTED'|'USABLE'|'CAUTION'|'REJECT';
    rowCount:number;
    validRows:number;
    invalidRows:number;
    duplicateRows:number;
    staleRows:number;
    consensusDepthCoverage:number;
    featureCoverage:number;
    blockers:string[];
    warnings:string[];
  };
};

type DbStats={
  configured:boolean;
  ok:boolean;
  counts?:{
    athletes?:number;
    player_game_stats?:number;
    market_snapshots?:number;
    market_consensus_snapshots?:number;
    model_runs?:number;
    bet_results?:number;
    automation_runs?:number;
    production_certifications?:number;
  };
};

type CalibrationResponse={
  source:string;
  latestRun?:{
    id:number;
    modelVersion:string;
    status:string;
    predictionRows:number;
    groupsEvaluated:number;
    groupsPromoted:number;
    groupsHeld:number;
    completedAt?:string;
  }|null;
  weights:Array<{
    modelName:string;
    sport:string;
    marketKey:string;
    multiplier:number;
    sampleSize:number;
    holdoutSampleSize?:number;
    calibrationError?:number;
    brierScore?:number;
    promoted:boolean;
    reason?:string;
  }>;
  models:Array<{
    modelName:string;
    sport:string;
    marketKey:string;
    sampleSize:number;
    decayedScore:number;
    confidenceLabel:string;
    calibrationError?:number;
    brierScore?:number;
  }>;
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
  const [calibration,setCalibration]=useState<CalibrationResponse>({source:'none',weights:[],models:[]});
  const [modelDiagnostics,setModelDiagnostics]=useState<ModelDiagnosticsResponse|null>(null);
  const [releaseCertification,setReleaseCertification]=useState<ReleaseCertificationResponse|null>(null);
  const [automationHealth,setAutomationHealth]=useState<AutomationHealthResponse|null>(null);
  const [dataQuality,setDataQuality]=useState<DataQualityResponse|null>(null);
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
  const [selectedMarket,setSelectedMarket]=useState<{id:string;market:string;selection:string}|null>(null);
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
    let mounted=true;
    const load=async()=>{
      try{
        const res=await fetch('/api/intelligence/calibration',{cache:'no-store'});
        if(!res.ok)return;
        const json=await res.json() as CalibrationResponse;
        if(mounted)setCalibration(json);
      }catch{}
    };
    void load();
    const timer=window.setInterval(()=>void load(),60000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const res=await fetch('/api/intelligence/model-diagnostics',{cache:'no-store'});
        if(!res.ok)return;
        const json=await res.json() as ModelDiagnosticsResponse;
        if(mounted)setModelDiagnostics(json);
      }catch{}
    };
    void load();
    const timer=window.setInterval(()=>void load(),60000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const [certRes,automationRes,dataRes]=await Promise.all([
          fetch('/api/release/certify',{cache:'no-store'}),
          fetch('/api/automation/health',{cache:'no-store'}),
          fetch('/api/data-quality',{cache:'no-store'})
        ]);
        if(!mounted)return;
        if(certRes.ok)setReleaseCertification(await certRes.json() as ReleaseCertificationResponse);
        if(automationRes.ok)setAutomationHealth(await automationRes.json() as AutomationHealthResponse);
        if(dataRes.ok)setDataQuality(await dataRes.json() as DataQualityResponse);
      }catch{}
    };
    void load();
    const timer=window.setInterval(()=>void load(),60000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  const effectiveSport=sport==='ALL'||board.sports.includes(sport)?sport:'ALL';

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
    if(effectiveSport!=='ALL'&&x.sport!==effectiveSport)return false;
    if(period!=='ALL'&&x.period!==period)return false;
    if(market!=='ALL'&&x.market!==market)return false;
    if(x.simProbability<minSim/100)return false;
    if(x.odds<minOdds||x.odds>maxOdds)return false;
    return true;
  }),[board.rows,effectiveSport,period,market,minSim,minOdds,maxOdds]);

  const probabilitySet=useMemo(()=>buildProbabilitySet(filtered,parlaySize,board.learnedSgpCorrelations),[filtered,parlaySize,board.learnedSgpCorrelations]);
  const mixedSet=useMemo(()=>buildMixedSportProbabilitySet(board.rows.filter(x=>x.simProbability>=minSim/100&&x.odds>=minOdds&&x.odds<=maxOdds),parlaySize,board.learnedSgpCorrelations),[board.rows,parlaySize,minSim,minOdds,maxOdds,board.learnedSgpCorrelations]);

  const amCount=filtered.filter(x=>x.period==='AM').length;
  const pmCount=filtered.filter(x=>x.period==='PM').length;
  const topGap=[...filtered].sort((a,b)=>Math.abs(b.probabilityGap)-Math.abs(a.probabilityGap)).slice(0,10);
  const predictions=[...board.predictions.contracts].sort((a,b)=>Math.abs(b.probabilityDifference)-Math.abs(a.probabilityDifference)).slice(0,12);

  return <main className="v21">
    <header className="v21Top">
      <div>
        <div className="eyebrow">EDGEFORCE AI • V41</div>
        <h1>Production Certification + Final Hardening</h1>
        <p>The planned elite roadmap is complete. Edgeforce now certifies release identity, market data contracts, scheduled automation, provider health, security posture, migration state, and post-deploy readiness around the V40 explainable prediction stack.</p>
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
    {board.providerDegraded&&<div className="v21Alert">Provider degraded mode is active. {board.providerQuality?.grade?`Current payload grade: ${board.providerQuality.grade}. `:''}{board.warnings?.[0]||'Edgeforce is using a fallback source or caution-grade provider data.'}</div>}
    {board.consensusCoverage&&board.consensusCoverage.configuredFeeds>1&&board.consensusCoverage.multiBookRows===0&&<div className="v21Alert">Consensus depth is limited: multiple feeds are configured, but no displayed row currently has two distinct book prices after reconciliation.</div>}
    {board.resimulationTriggered&&<div className="v21Alert">Automatic repricing triggered for {board.resimulatedMarketIds?.length||0} market{(board.resimulatedMarketIds?.length||0)===1?'':'s'}. {(board.contextChanges||[]).slice(0,2).map(x=>x.type.replaceAll('_',' ')).join(' • ')}{board.contextRevision?` • revision ${board.contextRevision}`:''}</div>}

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
          <div><small>Feed</small><b>{board.providerDegraded?'DEGRADED':board.providerQuality?.grade||'READY'}</b></div>
          <div><small>Feeds</small><b>{board.consensusCoverage?.acceptedFeeds??1}</b></div>
          <div><small>Multi-book</small><b>{board.consensusCoverage?.multiBookRows??0}</b></div>
          <div><small>Price shops</small><b>{board.consensusCoverage?.priceShopOpportunities??0}</b></div>
          <div><small>Stable</small><b>{board.regimeCoverage?.stable??0}</b></div>
          <div><small>Dislocated</small><b>{board.regimeCoverage?.dislocated??0}</b></div>
          <div><small>High conf</small><b>{board.regimeCoverage?.highConfidence??0}</b></div>
          <div><small>Avg conf</small><b>{board.regimeCoverage?fmtPct(board.regimeCoverage.averageDynamicConfidence):'—'}</b></div>
          <div><small>Data audit</small><b>{dataQuality?.audit?.grade||'—'}</b></div>
          <div><small>Automation</small><b>{automationHealth?(automationHealth.healthy?'HEALTHY':automationHealth.failedCount?'FAILED':automationHealth.staleCount?'STALE':'PENDING'):'—'}</b></div>
          <div><small>Release cert</small><b>{releaseCertification?.latest?(releaseCertification.latest.certified?'CERTIFIED':'BLOCKED'):'AWAITING'}</b></div>
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
        <select value={effectiveSport} onChange={e=>setSport(e.target.value)}>
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
      <div><small>AVG CONSENSUS</small><strong>{filtered.length?fmtPct(filtered.reduce((s,x)=>s+x.noVigProbability,0)/filtered.length):'—'}</strong><span>{board.consensusCoverage?.averageAgreement!==undefined?`${fmtPct(board.consensusCoverage.averageAgreement)} avg agreement`:'cross-book baseline'}</span></div>
      <div><small>DYNAMIC CONF</small><strong>{filtered.length?fmtPct(filtered.reduce((sum,x)=>sum+x.dynamicConfidence,0)/filtered.length):'—'}</strong><span>{board.regimeCoverage?.dislocated??0} dislocated • {board.regimeCoverage?.volatile??0} volatile</span></div>
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
            <th>#</th><th>Sport</th><th>Event / Selection</th><th>Time</th><th>Market</th><th>Odds</th><th>Raw %</th><th>Consensus %</th><th>PM %</th><th>Sim %</th><th>Confidence</th><th>Target Edge</th><th>PM Edge</th><th>1/4 Kelly</th><th>Engine</th><th>Sims</th><th>Grade</th>
          </tr></thead>
          <tbody>
            {filtered.map((x,i)=><tr key={x.id}>
              <td className="rankCell">{i+1}</td>
              <td><span className="sportPill">{x.sport}</span></td>
              <td><b>{x.event}</b><small>{x.selection}</small></td>
              <td><b>{x.period}</b><small>{dateLabel(x.startTime)}</small></td>
              <td>{x.market}</td>
              <td><b>{fmtOdds(x.odds)}</b><small>{x.consensus?`${x.consensus.targetBookFound?x.consensus.targetBook:'target missing'} • best ${fmtOdds(x.consensus.bestOdds)} ${x.consensus.bestBook||''}`:x.sourceBook||board.targetBook||'single source'}</small><small>{x.lineMovement?('open '+fmtOdds(x.lineMovement.openerOdds)+' • '+x.lineMovement.direction+(x.lineMovement.steam?' • '+x.lineMovement.steamStrength+' STEAM':'')):'no history'}</small></td>
              <td>{fmtPct(x.rawImpliedProbability)}</td>
              <td><b>{fmtPct(x.noVigProbability)}</b><small>{x.consensus?`${x.consensus.bookCount} books • ${fmtPct(x.consensus.agreement)} agree • ${x.consensus.marketStructure.replaceAll('_',' ')}`:'single-source baseline'}</small></td>
              <td><b>{x.predictionMarketProbability!==undefined?fmtPct(x.predictionMarketProbability):'—'}</b><small>{x.predictionMarketStatus==='MATCHED'?(x.predictionMarketVolume!==undefined?`vol ${Math.round(x.predictionMarketVolume).toLocaleString()}`:'matched'):x.predictionMarketStatus.replaceAll('_',' ')}</small></td>
              <td className="lime"><b>{fmtPct(x.simProbability)}</b><small>raw {fmtPct(x.rawSimProbability)} • CI {fmtPct(x.simCi[0])}–{fmtPct(x.simCi[1])}</small></td>
              <td><b>{fmtPct(x.dynamicConfidence)}</b><small>{x.confidenceLabel} • {x.regime}</small></td>
              <td className={x.sportsbookEdge>=0?'lime':'negative'}>{x.sportsbookEdge>=0?'+':''}{fmtPct(x.sportsbookEdge)}</td>
              <td className={(x.predictionEdge??0)>=0?'lime':'negative'}>{x.predictionEdge===undefined?'—':`${x.predictionEdge>=0?'+':''}${fmtPct(x.predictionEdge)}`}</td>
              <td>{fmtPct(x.quarterKelly)}</td>
              <td><b>{x.simEngine.replaceAll('_',' ')}</b><small>{x.simProjection.microUnit?`${x.simProjection.microUnitCount?.toFixed(1)??'—'} ${x.simProjection.microUnit} avg • p10 ${x.simProjection.p10?.toFixed(1)??'—'} • p50 ${x.simProjection.p50?.toFixed(1)??'—'} • p90 ${x.simProjection.p90?.toFixed(1)??'—'}`:x.simProjection.distributionFamily?`${x.simProjection.distributionFamily} • p10 ${x.simProjection.p10?.toFixed(1)??'—'} • p50 ${x.simProjection.p50?.toFixed(1)??'—'} • p90 ${x.simProjection.p90?.toFixed(1)??'—'}`:(x.playerContext?`${x.playerContext.name}${x.playerContext.status?` • ${x.playerContext.status}`:''}${x.playerContext.starter===false?' • not starting':''}`:(x.simProjection.unit?`${x.simProjection.totalMean!==undefined?x.simProjection.totalMean.toFixed(1):x.simProjection.selectionMean!==undefined?x.simProjection.selectionMean.toFixed(1):''} ${x.simProjection.unit}`:''))}</small></td>
              <td>{x.simulationRuns.toLocaleString()}</td>
              <td><span className={'grade '+x.grade.toLowerCase()}>{x.grade}</span><button className="ackBtn" onClick={()=>setSelectedMarket({id:x.id,market:x.market,selection:x.selection})}>EXPLAIN</button></td>
            </tr>)}
            {!filtered.length&&<tr><td colSpan={17} className="emptyRow">No rows match the current filters.</td></tr>}
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
          <div className="setScore"><small>JOINT MODEL %</small><strong>{pct(probabilitySet.combinedProbability)}</strong><span>{probabilitySet.jointSimulationRuns.toLocaleString()} correlated sims • independent {pct(probabilitySet.independentProbability)} • {probabilitySet.learnedPairCount} learned pairs</span></div>
          <div className="legList">{probabilitySet.legs.map((x,i)=><div key={x.id}><span>{i+1}</span><div><b>{x.selection}</b><small>{x.sport} • {x.market} • sim {fmtPct(x.simProbability)}</small></div></div>)}</div>
        </div>:<p className="muted">Not enough qualified rows for this leg count under the current filters.</p>}
      </div>

      <div className="v21Card">
        <div className="v21CardHead"><div><div className="eyebrow">MULTI-SPORT</div><h3>Cross-sport probability set</h3></div><span className="miniBadge">{parlaySize} legs</span></div>
        {mixedSet?<div className="setBody">
          <div className="setScore"><small>JOINT MODEL %</small><strong>{pct(mixedSet.combinedProbability)}</strong><span>{mixedSet.jointSimulationRuns.toLocaleString()} correlated sims • {mixedSet.eventCount} events • {mixedSet.learnedPairCount} learned pairs</span></div>
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
        <div><div className="eyebrow">V40 MODEL DIAGNOSTICS</div><h3>Fragility, concentration, disagreement, and ablation risk</h3></div>
        <span className="miniBadge">{modelDiagnostics?.sampleSize||0} markets analyzed</span>
      </div>
      <div className="v21Stats">
        <div><small>FRAGILE</small><strong>{modelDiagnostics?.summary.fragility.fragile||0}</strong><span>{modelDiagnostics?.summary.fragility.moderate||0} moderate • {modelDiagnostics?.summary.fragility.robust||0} robust</span></div>
        <div><small>AVG AGREEMENT</small><strong>{modelDiagnostics?pct(modelDiagnostics.summary.averageAgreement):'—'}</strong><span>model council consistency</span></div>
        <div><small>EFFECTIVE MODELS</small><strong>{modelDiagnostics?modelDiagnostics.summary.averageEffectiveModelCount.toFixed(1):'—'}</strong><span>after weight concentration</span></div>
        <div><small>AVG ABS EDGE</small><strong>{modelDiagnostics?pct(modelDiagnostics.summary.averageAbsoluteEdge):'—'}</strong><span>ensemble vs market baseline</span></div>
      </div>
      <div className="historyGrid">
        <div className="historyBox">
          <h4>Most fragile markets</h4>
          {(modelDiagnostics?.mostFragile||[]).slice(0,8).map(x=><div className="historyRow" key={x.market.id+x.market.market+x.market.selection}><span>{x.market.selection}</span><b>{x.explanation.diagnostics.fragility}</b><small>{x.market.sport} • ratio {x.explanation.diagnostics.fragilityRatio.toFixed(2)} • agreement {pct(x.explanation.diagnostics.councilAgreement)}</small></div>)}
          {!modelDiagnostics?.mostFragile?.length&&<div className="historyRow"><span>No diagnostics yet</span><b>—</b><small>diagnostics populate from current market rows</small></div>}
        </div>
        <div className="historyBox">
          <h4>Dominant model frequency</h4>
          {(modelDiagnostics?.summary.dominantModels||[]).slice(0,8).map(x=><div className="historyRow" key={x.name}><span>{x.name}</span><b>{x.count}</b><small>markets where this model has the largest normalized weight</small></div>)}
        </div>
      </div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">PORTFOLIO STRESS INTELLIGENCE</div><h3>Scenario stress testing + CVaR + continuous drawdown control</h3></div>
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
        <div><small>EXPECTED PROFIT</small><strong>{portfolio?money(portfolio.result.expectedProfit):'—'}</strong><span>model estimate • ROI {portfolio?pct(portfolio.result.expectedRoi):'—'}</span></div>
        <div><small>WORST 95% CVAR</small><strong>{portfolio?money(portfolio.result.stress.worstScenario.cvar95Loss):'—'}</strong><span>{portfolio?.result.stress.worstScenario.scenario.replaceAll('_',' ')||'stress scenario'}</span></div>
        <div><small>DRAWDOWN BREACH</small><strong>{portfolio?pct(portfolio.result.stress.worstScenario.drawdownBreachProbability):'—'}</strong><span>limit {portfolio?pct(portfolio.result.stress.drawdownLimitPct):'—'}</span></div>
      </div>
      <div className="v21Stats">
        <div><small>95% VAR</small><strong>{portfolio?money(portfolio.result.stress.worstScenario.var95Loss):'—'}</strong><span>worst scenario loss threshold</span></div>
        <div><small>LOSS PROBABILITY</small><strong>{portfolio?pct(portfolio.result.stress.worstScenario.probabilityOfLoss):'—'}</strong><span>{portfolio?.result.stress.runsPerScenario||0} sims per scenario</span></div>
        <div><small>DRAWDOWN BRAKE</small><strong>{portfolio?pct(portfolio.result.drawdownBrake):'—'}</strong><span>continuous bankroll throttle</span></div>
        <div><small>STRESS SCALE</small><strong>{portfolio?pct(portfolio.result.stressScale):'—'}</strong><span>CVaR allocation multiplier</span></div>
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
              <td><span className="grade strong">{(portfolio?.result.stressScale??1)<.85||(portfolio?.result.drawdownBrake??1)<.70||p.correlationExposurePct>=0.04?'REDUCE':'HOLD'}</span></td>
            </tr>)}
            {!portfolio?.result.positions.length&&<tr><td colSpan={9} className="emptyRow">No qualified positions under the current risk limits.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="historyGrid">
        <div className="historyBox">
          <h4>Stress scenarios</h4>
          {(portfolio?.result.stress.scenarios||[]).map(x=><div className="historyRow" key={x.scenario}><span>{x.scenario.replaceAll('_',' ')}</span><b>{money(x.cvar95Loss)}</b><small>CVaR • loss {pct(x.probabilityOfLoss)} • breach {pct(x.drawdownBreachProbability)}</small></div>)}
        </div>
        <div className="historyBox">
          <h4>Stress controls</h4>
          <div className="historyRow"><span>Drawdown throttle</span><b>{portfolio?pct(portfolio.result.drawdownBrake):'—'}</b><small>falls continuously as current drawdown rises</small></div>
          <div className="historyRow"><span>CVaR throttle</span><b>{portfolio?pct(portfolio.result.stressScale):'—'}</b><small>scales all accepted positions when tail risk exceeds limit</small></div>
          <div className="historyRow"><span>Positions</span><b>{portfolio?.result.positions.length||0}</b><small>{portfolio?.result.rejected.length||0} rejected before stress scaling</small></div>
        </div>
      </div>
      <div className="historyNote">Stress metrics are model-based estimates under defined scenarios. They reduce exposure when modeled tail risk rises, but cannot guarantee profit or bound real-world losses.</div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">PREDICTION MARKETS</div><h3>Liquid contracts fused into matching sportsbook rows</h3></div>
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
        <p>Set PREDICTION_PROVIDER_PRIMARY_URL and its key in Vercel to populate this section. Matched contracts above the configured volume threshold are eligible for model-vs-market edge.</p>
      </div>}
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">MODEL CALIBRATION</div><h3>Walk-forward validation + controlled weight promotion</h3></div>
        <span className="miniBadge">{calibration.latestRun?.status||'awaiting history'}</span>
      </div>
      <div className="v21Stats">
        <div><small>PREDICTION ROWS</small><strong>{calibration.latestRun?.predictionRows||0}</strong><span>settled model forecasts</span></div>
        <div><small>GROUPS TESTED</small><strong>{calibration.latestRun?.groupsEvaluated||0}</strong><span>model × sport × market</span></div>
        <div><small>PROMOTED</small><strong>{calibration.latestRun?.groupsPromoted||0}</strong><span>{calibration.latestRun?.groupsHeld||0} held neutral</span></div>
        <div><small>ACTIVE WEIGHTS</small><strong>{calibration.weights.filter(x=>x.promoted).length}</strong><span>latest qualified snapshots</span></div>
      </div>
      <div className="historyNote">Weights change only after minimum-sample, holdout and walk-forward checks. Insufficient or unstable groups remain at a neutral 1.00 multiplier.</div>
      <div className="historyGrid">
        <div className="historyBox">
          <h4>Largest promoted adjustments</h4>
          {calibration.weights.filter(x=>x.promoted).sort((a,b)=>Math.abs(b.multiplier-1)-Math.abs(a.multiplier-1)).slice(0,8).map(x=><div className="historyRow" key={x.modelName+x.sport+x.marketKey}><span>{x.modelName} • {x.sport}</span><b>{x.multiplier.toFixed(3)}×</b><small>{x.marketKey} • n={x.sampleSize}</small></div>)}
          {!calibration.weights.some(x=>x.promoted)&&<div className="historyRow"><span>No promoted weights yet</span><b>1.000×</b><small>neutral until enough settled history exists</small></div>}
        </div>
        <div className="historyBox">
          <h4>Model calibration leaders</h4>
          {[...calibration.models].sort((a,b)=>b.decayedScore-a.decayedScore).slice(0,8).map(x=><div className="historyRow" key={x.modelName+x.sport+x.marketKey}><span>{x.modelName} • {x.sport}</span><b>{pct(x.decayedScore)}</b><small>{x.confidenceLabel} • n={x.sampleSize}{x.calibrationError!==undefined?` • cal ${pct(x.calibrationError)}`:''}</small></div>)}
          {!calibration.models.length&&<div className="historyRow"><span>Calibration history</span><b>—</b><small>settled model predictions will populate this automatically</small></div>}
        </div>
      </div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">BANKROLL + PERFORMANCE LEDGER</div><h3>Persistent settled-wager analytics</h3></div>
        <span className="miniBadge">{board.history.settledCount||0} settled • {board.history.pendingCount||0} open</span>
      </div>
      <div className="v21Stats">
        <div><small>CUMULATIVE STAKE</small><strong>{money(board.history.overall.staked)}</strong><span>{board.history.sampleSize} total recorded slips</span></div>
        <div><small>CUMULATIVE RETURN</small><strong>{money(board.history.overall.returned)}</strong><span>settled wagers only</span></div>
        <div><small>NET P/L</small><strong>{money(board.history.overall.net)}</strong><span>ROI {pct(board.history.overall.roi||0)}</span></div>
        <div><small>MODEL WIN / LOSS AVG</small><strong>{board.history.avgModelWinner!==undefined?pct(board.history.avgModelWinner):'—'}</strong><span>losers {board.history.avgModelLoser!==undefined?pct(board.history.avgModelLoser):'—'}</span></div>
      </div>
      <div className="historyNote">Open wagers are excluded from settled ROI and hit-rate calculations. Unknown hidden leg outcomes stay unknown rather than being guessed.</div>
      <div className="historyGrid">
        <div className="historyBox">
          <h4>Parlay performance by sport</h4>
          {board.history.sports.map(x=><div className="historyRow" key={x.key}><span>{x.key}</span><b>{pct(x.hitRate)}</b><small>{x.hits}-{x.misses} • ROI {pct(x.roi||0)} • net {money(x.net)}</small></div>)}
        </div>
        <div className="historyBox">
          <h4>By parlay size</h4>
          {board.history.legCounts.map(x=><div className="historyRow" key={x.key}><span>{x.key} legs</span><b>{pct(x.hitRate)}</b><small>{x.hits}-{x.misses} • ROI {pct(x.roi||0)} • net {money(x.net)}</small></div>)}
        </div>
        <div className="historyBox">
          <h4>Individual leg hit rate by sport</h4>
          {(board.history.legSports||[]).map(x=><div className="historyRow" key={x.key}><span>{x.key}</span><b>{pct(x.hitRate)}</b><small>{x.hits}-{x.misses} known legs</small></div>)}
        </div>
        <div className="historyBox">
          <h4>Market-type hit rate</h4>
          {board.history.markets.map(x=><div className="historyRow" key={x.key}><span>{x.key}</span><b>{pct(x.hitRate)}</b><small>{x.hits}-{x.misses} known legs</small></div>)}
        </div>
        <div className="historyBox">
          <h4>Model probability bands</h4>
          {(board.history.probabilityBands||[]).map(x=><div className="historyRow" key={x.key}><span>{x.key}</span><b>{pct(x.hitRate)}</b><small>{x.hits}-{x.misses} known outcomes</small></div>)}
        </div>
        <div className="historyBox">
          <h4>Current leaders</h4>
          <div className="historyRow"><span>Best sport</span><b>{board.history.bestSport||'—'}</b><small>minimum two settled decisions</small></div>
          <div className="historyRow"><span>Best parlay size</span><b>{board.history.bestParlaySize?board.history.bestParlaySize+' legs':'—'}</b><small>ranked by ROI, then hit rate</small></div>
        </div>
      </div>
    </section>

    <section className="v21FooterGrid">
      <div><small>ATHLETES</small><b>{dbStats.counts?.athletes||0}</b></div>
      <div><small>PLAYER GAME STATS</small><b>{dbStats.counts?.player_game_stats||0}</b></div>
      <div><small>MARKET SNAPSHOTS</small><b>{dbStats.counts?.market_snapshots||0}</b></div>
      <div><small>CONSENSUS SNAPSHOTS</small><b>{dbStats.counts?.market_consensus_snapshots||0}</b></div>
      <div><small>MODEL RUNS</small><b>{dbStats.counts?.model_runs||0}</b></div>
      <div><small>SETTLED RESULTS</small><b>{dbStats.counts?.bet_results||0}</b></div>
    </section>
    {selectedMarket&&<MarketDrilldown marketId={selectedMarket.id} marketKey={selectedMarket.market} selection={selectedMarket.selection} onClose={()=>setSelectedMarket(null)}/>}
  </main>;
}
