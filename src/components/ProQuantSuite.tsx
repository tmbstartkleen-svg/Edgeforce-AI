'use client';
import {useMemo,useState} from 'react';
import {priceResearch,summarizeBets,summarizeEpa,type HistoricalBet,type EpaRow} from '@/lib/proQuant';
import type {ProIntegration} from '@/lib/proIntegrations';

type View='PRICES'|'LEDGER'|'EPA'|'CONNECTORS';
type AnalystResult={ok:boolean;analysis?:string;status?:string;message?:string;remainingToday?:number};
const money=(v:number)=>Number.isFinite(v)?v.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}):'—';
const pct=(v:number|null)=>v===null||!Number.isFinite(v)?'—':(100*v).toFixed(2)+'%';
const odds=(v:number|null)=>v===null?'—':(v>0?'+':'')+v;
const number=(s:string)=>s.trim()?Number(s):NaN;
const decimal=(s:string)=>s.trim()?Number(s):NaN;
const validNumber=(n:number)=>Number.isFinite(n);
const normalize=(s:string)=>s.trim().toUpperCase();
function parseEpaCsv(text:string):{rows:EpaRow[];skipped:number}{
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
 if(!lines.length||text.length>300000)return {rows:[],skipped:0};
 const head=lines[0].split(',').map(x=>x.trim().toLowerCase());
 const ix=(name:string)=>head.indexOf(name);
 if(['posteam','epa','play_type'].some(k=>ix(k)<0))return {rows:[],skipped:lines.length};
 let skipped=0;const rows:EpaRow[]=[];
 for(const line of lines.slice(1,3001)){
  const cells=line.split(',');
  const team=normalize(cells[ix('posteam')]||'');
  const epa=decimal(cells[ix('epa')]||'');
  const play=(cells[ix('play_type')]||'').toLowerCase().trim();
  const sr=ix('success')>=0?cells[ix('success')]:undefined;
  const success=sr==='1'?1:sr==='0'?0:null;
  if(!/^[A-Z]{2,4}$/.test(team)||!Number.isFinite(epa)||Math.abs(epa)>30||(play!=='pass'&&play!=='run')){skipped++;continue}
  rows.push({posteam:team,epa,play_type:play,success});
 }
 return {rows,skipped};
}
function parseBetCsv(value:string){
 const lines=value.trim().split(/\r?\n/);
 if(lines.length<2||value.length>100000)return {rows:[] as HistoricalBet[],skipped:0};
 const fields=lines[0].toLowerCase().split(',').map(x=>x.trim());
 const required=['id','date','sport','selection','book','stake','odds','closingodds','result'];
 if(required.some(f=>!fields.includes(f)))return {rows:[] as HistoricalBet[],skipped:lines.length-1};
 const at=(cells:string[],k:string)=>(cells[fields.indexOf(k)]||'').trim();
 const rows:HistoricalBet[]=[];let skipped=0;
 for(const line of lines.slice(1,501)){
  const cells=line.split(',');
  const id=at(cells,'id'),stake=number(at(cells,'stake')),o=number(at(cells,'odds')),closing=at(cells,'closingodds');
  const result=at(cells,'result').toUpperCase();
  if(!id||!validNumber(stake)||stake<=0||!validNumber(o)||Math.abs(o)<100||
   !['WIN','LOSS','PUSH','OPEN'].includes(result)||!validNumber(Date.parse(at(cells,'date')))){skipped++;continue}
  const c=closing?number(closing):null;
  if(c!==null&&(!validNumber(c)||Math.abs(c)<100)){skipped++;continue}
  rows.push({id,date:at(cells,'date'),sport:at(cells,'sport').slice(0,35),
   selection:at(cells,'selection').slice(0,70),book:at(cells,'book').slice(0,35),
   stake,odds:o,closingOdds:c,result:result as HistoricalBet['result']});
 }
 return {rows,skipped};
}
export default function ProQuantSuite(){
 const [tab,setTab]=useState<View>('PRICES');
 const [referenceA,setReferenceA]=useState('-110');
 const [referenceB,setReferenceB]=useState('-110');
 const [offered,setOffered]=useState('+120');
 const [modelPct,setModelPct]=useState('');
 const [books,setBooks]=useState('1');
 const [age,setAge]=useState('10');
 const [ledgerCsv,setLedgerCsv]=useState('');
 const [epaCsv,setEpaCsv]=useState('');
 const [integrations,setIntegrations]=useState<ProIntegration[]|null>(null);
 const [integrationError,setIntegrationError]=useState('');
 const [adminToken,setAdminToken]=useState('');
 const [busy,setBusy]=useState(false);
 const [ai,setAi]=useState<AnalystResult|null>(null);
 const pricing=useMemo(()=>priceResearch({
  referenceA:number(referenceA),referenceB:number(referenceB),offered:number(offered),
  estimate:modelPct.trim()?number(modelPct)/100:null,
  books:number(books),quoteAgeMin:number(age)
 }),[referenceA,referenceB,offered,modelPct,books,age]);
 const ledger=useMemo(()=>parseBetCsv(ledgerCsv),[ledgerCsv]);
 const performance=useMemo(()=>summarizeBets(ledger.rows),[ledger.rows]);
 const epa=useMemo(()=>parseEpaCsv(epaCsv),[epaCsv]);
 const epaSummary=useMemo(()=>summarizeEpa(epa.rows),[epa.rows]);
 const loadConnections=async()=>{
  setIntegrationError('');
  try{
   const r=await fetch('/api/pro/integrations',{cache:'no-store'});
   const j=await r.json() as {connections:ProIntegration[]};
   if(!r.ok)throw new Error('Connection inventory unavailable');
   setIntegrations(j.connections);
  }catch{setIntegrationError('Could not retrieve integration inventory.');}
 };
 const runAi=async()=>{
  if(!adminToken||busy)return;
  setBusy(true);setAi(null);
  try{
   const r=await fetch('/api/pro/analyst',{method:'POST',headers:{
    'Content-Type':'application/json','Authorization':'Bearer '+adminToken
   },body:JSON.stringify({referenceA:number(referenceA),referenceB:number(referenceB),
    offered:number(offered),books:number(books),quoteAgeMin:number(age),
    estimate:modelPct.trim()?number(modelPct)/100:null})});
   const data=await r.json() as AnalystResult;
   setAi(data.ok?data:{ok:false,status:data.status||'UNAVAILABLE',
    message:data.message||'AI explanation unavailable; pricing calculator remains usable.'});
  }catch{setAi({ok:false,message:'Network or gateway response unavailable.'});}
  finally{setBusy(false)}
 };
 return <section className="efProQuant" id="pro-quant" aria-label="Professional quantitative sports analysis">
  <div className="efProHero">
   <div><div className="efKicker">EDGEFORCE AI / PRO QUANT SUITE / V203</div>
    <h2>Build the model. <em>Price the edge.</em></h2>
    <p>Native price intelligence, historical ROI, closing-line tracking, NFL play-by-play EPA and licensed integration readiness. Analyze evidence without pretending to have professional source rights or live quotes.</p>
   </div>
   <div className="efProHeroSignal"><span>TRADING STANDARD</span><b>Evidence before entry.</b><small>Models can be wrong. Historical performance is not guaranteed.</small></div>
  </div>
  <nav className="efProTabs" aria-label="Professional analytics workspaces">
   {([['PRICES','Price & +EV Lab'],['LEDGER','Bankroll / CLV'],['EPA','NFL Play-by-play EPA'],['CONNECTORS','Data & Partners']] as const).map(([id,label])=>
    <button type="button" key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}
  </nav>
  {tab==='PRICES'&&<div className="efProColumns">
   <div className="efProSurface"><div className="efKicker">BOOKMAKER REFERENCE / FAIR PRICE</div><h3>Price workbench</h3>
    <p>Enter matching opposite sides from a reference book, plus an independently offered price. These values are **manual inputs**, not live DraftKings or Kalshi quotes.</p>
    <div className="efProFields">
     <label>Reference: side A (American odds)<input type="number" value={referenceA} onChange={e=>setReferenceA(e.target.value)}/></label>
     <label>Reference: opposite side B<input type="number" value={referenceB} onChange={e=>setReferenceB(e.target.value)}/></label>
     <label>Offered selection odds<input type="number" value={offered} onChange={e=>setOffered(e.target.value)}/></label>
     <label>Independent model probability (%)<input type="number" min="0" max="100" step=".1" placeholder="Optional" value={modelPct} onChange={e=>setModelPct(e.target.value)}/></label>
     <label>Independent reference bookmakers<input type="number" min="0" max="50" value={books} onChange={e=>setBooks(e.target.value)}/></label>
     <label>Quote age (minutes)<input type="number" min="0" max="9999" value={age} onChange={e=>setAge(e.target.value)}/></label>
    </div>
    <div className="efProNote">The two reference sides must belong to the same event, line and settlement rules. Set independent bookmaker count using verified sources, not estimates.</div>
   </div>
   <div className="efProSurface">
    <div className="efKicker">QUANT READOUT</div><h3>Fair value and execution gate</h3>
    <div className="efProMetrics"><div><small>No-vig fair win probability</small><b>{pct(pricing.fairProbability)}</b></div>
     <div><small>No-vig fair American odds</small><b>{odds(pricing.noVigOdds)}</b></div>
     <div><small>Reference hold</small><b>{pct(pricing.referenceHold)}</b></div>
     <div><small>Reference-priced EV</small><b>{pct(pricing.referenceEv)}</b></div>
     <div><small>Independent-model EV</small><b>{pct(pricing.modelEv)}</b></div>
     <div><small>Decision</small><b className="efProStatus">{pricing.status.replaceAll('_',' ')}</b></div>
    </div>
    <div className="efProReasons"><b>Data-quality requirements</b>{(pricing.flags.length?pricing.flags:['Manual estimates pass basic checks. Verify market and live execution before any action.']).map(x=><p key={x}>{x}</p>)}</div>
    <div className="efProAi">
     <b>GPT analyst — optional, paid API</b><p>Interprets these price calculations without inventing game facts. Requires a private operator token and a configured AI Gateway account; nothing is sent automatically.</p>
     <label>Operator access token<input type="password" autoComplete="off" placeholder="Enter operator token only on your own trusted device" value={adminToken} onChange={e=>setAdminToken(e.target.value)}/></label>
     <button type="button" disabled={busy||adminToken.length<32} onClick={()=>void runAi()}>{busy?'Analyzing…':'Explain this market with AI'}</button>
     {ai&&<div className="efProAiResult" role="status">{ai.ok?ai.analysis:ai.message||ai.status}{ai.ok&&ai.remainingToday!==undefined&&<p>Shared AI analyses remaining today: {ai.remainingToday}</p>}</div>}
    </div>
   </div>
  </div>}
  {tab==='LEDGER'&&<div className="efProColumns">
   <div className="efProSurface"><div className="efKicker">PORTFOLIO ANALYTICS</div><h3>Import a bet ledger</h3>
    <p>Paste CSV with columns: <code>id,date,sport,selection,book,stake,odds,closingOdds,result</code>. Results are WIN, LOSS, PUSH, or OPEN. No upload or database write; data stays in this browser session.</p>
    <textarea rows={9} spellCheck={false} placeholder={'id,date,sport,selection,book,stake,odds,closingOdds,result\nb1,2026-10-03,NFL,Example team,Book A,10,+120,+105,WIN'} value={ledgerCsv} onChange={e=>setLedgerCsv(e.target.value)}/>
    <small>{ledger.rows.length} valid rows · {ledger.skipped} skipped · maximum 500 imported rows</small>
   </div>
   <div className="efProSurface"><div className="efKicker">SETTLED RETURNS / CLV</div><h3>Performance scorecard</h3>
    <div className="efProMetrics"><div><small>Settled bets</small><b>{performance.settled}</b></div>
     <div><small>Total risked</small><b>{money(performance.stake)}</b></div>
     <div><small>Net return</small><b>{money(performance.profit)}</b></div>
     <div><small>ROI on settled stakes</small><b>{pct(performance.roi)}</b></div>
     <div><small>Settled win rate</small><b>{pct(performance.winRate)}</b></div>
     <div><small>Mean change in implied close probability</small><b>{pct(performance.meanClvImplied)}</b></div>
    </div><p>{performance.clvCount} of {performance.settled} settled bets have a comparable closing price. Closing-line movement is descriptive, not proof that the model is calibrated.</p>
   </div>
  </div>}
  {tab==='EPA'&&<div className="efProColumns">
   <div className="efProSurface"><div className="efKicker">NFL FOOTBALL / HISTORICAL PBP</div><h3>EPA and success-rate lab</h3>
    <p>Paste licensed/open play-by-play CSV data with <code>posteam,epa,play_type,success</code>. NFLverse offers a public historical EPA pipeline; this module uses only data you provide, not made-up play tracking.</p>
    <textarea rows={10} spellCheck={false} placeholder={'posteam,epa,play_type,success\nBUF,0.12,pass,1\nBUF,-0.27,run,0'} value={epaCsv} onChange={e=>setEpaCsv(e.target.value)}/>
    <small>{epa.rows.length} accepted plays · {epa.skipped} rejected rows · max 3,000 plays · CSV must be a simple flat export</small>
   </div>
   <div className="efProSurface"><div className="efKicker">DESCRIPTIVE TEAM METRICS</div><h3>EPA performance by team</h3>
    {epaSummary.length?<div className="efProEpaTable">{epaSummary.slice(0,30).map(x=><div key={x.team}><b>{x.team}</b><span>{x.plays} plays</span><strong>{x.epaPerPlay.toFixed(3)} EPA/play</strong><small>{pct(x.successRate)} success · {pct(x.passShare)} pass</small></div>)}</div>:
     <div className="efEmpty">Paste at least three valid offensive plays per team. No sample games are fabricated.</div>}
    <div className="efProNote">Use historical EPA, scheme and situational stats as model inputs. They do not establish a price advantage without current lineups, recent injuries, calibration and executable odds.</div>
   </div>
  </div>}
  {tab==='CONNECTORS'&&<div className="efProSurface"><div className="efKicker">INTEGRATION CONTROL CENTER</div><h3>Venue and professional-data inventory</h3>
   <p>Public-readable means an adapter exists; key present means a secret is configured. Neither status guarantees a live, working feed. Licensed tactical/video systems require separate commercial rights.</p>
   <button type="button" className="efProLoad" onClick={()=>void loadConnections()}>Check configured connections</button>
   {integrationError&&<p role="alert">{integrationError}</p>}
   {integrations&&<div className="efProConnectors">{integrations.map(x=><article key={x.id}>
    <div><span className="efKicker">{x.category.replaceAll('_',' ')}</span><h4>{x.name}</h4></div>
    <strong>{x.status.replaceAll('_',' ')}</strong>
    <p>{x.description}</p><small>{x.next}</small>
   </article>)}</div>}
   {!integrations&&<div className="efEmpty">Click to read configuration readiness. No vendor credentials are displayed.</div>}
  </div>}
  <p className="efProFooter">Professional analytical tools are included in the EdgeForce code. Live league-owned tracking, commercial film, paid feeds, and authorized bookmaker pricing still require appropriate source access. No wagers are routed by this workspace.</p>
 </section>;
}
