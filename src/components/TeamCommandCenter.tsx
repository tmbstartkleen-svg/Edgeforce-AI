'use client';

import {useCallback,useEffect,useRef,useState} from 'react';

type AgentId='scout'|'lines'|'props'|'arb'|'audit'|'captain';
type Persona={id:AgentId;name:string;specialty:string};
type SpecialistMessage={agent:AgentId;name:string;specialty:string;text:string;evidence:string[]};
type Coverage={sports:number;leagues:number;events:number;marketSelections:number;panelQuotes:number;bySport:Array<{sport:string;rows:number;leagues:number}>};
type TeamRound={
 ok:true;generatedAt:string;question:string;messages:SpecialistMessage[];
 coverage:Coverage;evidenceState:'LIVE'|'STORED'|'DEMO'|'UNAVAILABLE';
 independentModelVerified:false;quoteFreshnessVerified:false;actionableBetRecommendations:false;
 questionForUser:string|null;quoteCount:number;referenceEdgeCandidates:number;arbitrageCandidates:number;
 source:{mode:string;name:string|null;providerId:string|null;degraded:boolean;warnings:string[];usedStoredData:boolean};
 quality:{grade:string;score:number;validRows:number;invalidRows:number;staleRows:number};
 limitations:string;
};
type Turn={id:string;question:string;response:TeamRound};
const agents:Persona[]=[
 {id:'scout',name:'Scout',specialty:'Sport & league coverage'},
 {id:'lines',name:'Lines',specialty:'Odds & value comparisons'},
 {id:'props',name:'Props',specialty:'Player markets & stats'},
 {id:'arb',name:'Arb',specialty:'Arbitrage research'},
 {id:'audit',name:'Audit',specialty:'Evidence & quality control'},
 {id:'captain',name:'Captain',specialty:'Research coordinator'}
];
const prompts=[
 'Which sports and leagues are covered right now?',
 'Find the best provisional +EV comparisons across all sports.',
 'Which player props have reliable data?',
 'Find arbitrage candidates and check quote freshness.',
 'What is missing from the DraftKings coverage?'
];
const STORE='edgeforce-team-research-history-v1';
const formatTime=(s:string)=>{try{return new Date(s).toLocaleString();}catch{return s;}};
const id=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);

export default function TeamCommandCenter(){
 const [turns,setTurns]=useState<Turn[]>([]);
 const [question,setQuestion]=useState('');
 const [active,setActive]=useState<'all'|AgentId>('all');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [loaded,setLoaded]=useState(false);
 const bottom=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{
  try{
   const saved=JSON.parse(localStorage.getItem(STORE)||'[]') as unknown;
   if(Array.isArray(saved))setTurns(saved.filter(x=>x&&typeof x==='object'&&'response'in x&&'question'in x).slice(-12) as Turn[]);
  }catch{ /* invalid client cache is safely ignored */ }
  setLoaded(true);
 },[]);
 useEffect(()=>{
  if(!loaded)return;
  try{localStorage.setItem(STORE,JSON.stringify(turns.slice(-12)));}catch{ /* storage unavailable */ }
 },[turns,loaded]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[turns,busy,error]);
 const last=turns.at(-1)?.response;
 const stats=last?.coverage;
 const ask=useCallback(async(requested?:string)=>{
  const text=(requested??question).trim();
  if(!text||text.length>500||busy)return;
  setBusy(true);setError('');setQuestion('');
  try{
   const result=await fetch('/api/team/research',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({question:text}),cache:'no-store'
   });
   const body=await result.json() as TeamRound|{ok:false;error?:string;message?:string};
   if(!result.ok||!body.ok)throw new Error(!body.ok?(body.message||body.error||'Research failed'):'Research failed');
   setTurns(prev=>[...prev,{id:id(),question:text,response:body}].slice(-12));
  }catch(e){
   setQuestion(text);
   setError(e instanceof Error?e.message:'Unable to contact the research network.');
  }finally{setBusy(false);}
 },[question,busy]);
 const clear=()=>{setTurns([]);setError('');setActive('all');};
 return <div className="teamApp">
  <div className="teamGrid">
   <aside className="teamSidebar" aria-label="AI research team">
    <div className="teamBrand"><span className="teamLogo">E<span>F</span></span><div><b>EDGEFORCE</b><small>INTELLIGENCE NETWORK</small></div></div>
    <div className="teamSideTitle">WORKSPACE</div>
    <button type="button" className={'teamNav '+(active==='all'?'selected':'')} onClick={()=>setActive('all')}>◈ <span>Team channel</span><small>6</small></button>
    <div className="teamSideTitle">SPECIALISTS</div>
    {agents.map(agent=><button type="button" key={agent.id} className={'teamNav '+(active===agent.id?'selected':'')} onClick={()=>setActive(agent.id)} title={agent.specialty}>
     <span className={'teamAvatar '+agent.id}>{agent.name.slice(0,1)}</span><span className="teamNavLabel"><b>{agent.name}</b><small>{agent.specialty}</small></span><span className="teamDot"/>
    </button>)}
    <div className="teamSideFoot">
     <strong>EVIDENCE-FIRST MODE</strong>
     <p>Specialists share one verified data snapshot per request. Responses are deterministic research summaries until an independent AI reasoning service is configured.</p>
    </div>
   </aside>
   <main className="teamMain">
    <header className="teamHead">
     <div><span className="teamEyebrow">OPERATIONS / RESEARCH</span><h1>{active==='all'?'Team Intelligence Room':agents.find(x=>x.id===active)?.name+' / Intelligence'}</h1><p>Ask questions across sports, leagues, odds, props and available research sources.</p></div>
     <div className="teamHeadRight"><span className={'teamState '+(last?.evidenceState==='LIVE'?'good':'')}>● {last?.evidenceState||'NOT SCANNED'}</span><button type="button" onClick={clear} disabled={busy||!turns.length}>Clear chat</button></div>
    </header>
    <div className="teamStats" aria-label="Current feed coverage">
     <div><small>SPORTS IN FEED</small><b>{stats?.sports??'—'}</b></div>
     <div><small>LEAGUES IN FEED</small><b>{stats?.leagues??'—'}</b></div>
     <div><small>EVENTS IN FEED</small><b>{stats?.events??'—'}</b></div>
     <div><small>MARKET SELECTIONS</small><b>{stats?.marketSelections??'—'}</b></div>
     <div><small>COMPARE QUOTES</small><b>{stats?.panelQuotes??'—'}</b></div>
    </div>
    <div className="teamContent">
     <section className="teamChat" aria-label="Team chat">
      {!turns.length&&<div className="teamWelcome">
       <div className="teamEmblem">EF<span>✦</span></div>
       <span className="teamEyebrow">CONNECTED SPECIALIST WORKFLOW</span>
       <h2>One question. Six research perspectives.</h2>
       <p>Scout surveys the available games. Lines tests cross-book prices. Props reviews player markets. Arb checks matched outcomes. Audit challenges data quality. Captain combines the findings and asks you for clarification when needed.</p>
       <div className="teamSuggestions">{prompts.map(p=><button key={p} type="button" onClick={()=>void ask(p)} disabled={busy}>{p}<span>↗</span></button>)}</div>
      </div>}
      {turns.map(turn=><div className="teamTurn" key={turn.id}>
       <div className="teamUserLine"><div className="teamUserText"><strong>You</strong><p>{turn.question}</p></div><span className="teamAvatar user">U</span></div>
       <div className="teamRoundMeta"><span>TEAM RESEARCH ROUND</span><time>{formatTime(turn.response.generatedAt)}</time><span>{turn.response.messages.length} specialist reports</span></div>
       {turn.response.messages.filter(x=>active==='all'||x.agent===active).map((entry,i)=><article className="teamMessage" key={entry.agent+'-'+i}>
        <span className={'teamAvatar '+entry.agent}>{entry.name.charAt(0)}</span>
        <div className="teamMessageBody"><div className="teamMessageHead"><b>{entry.name}</b><small>{entry.specialty}</small></div><p>{entry.text}</p><div className="teamEvidence">{entry.evidence.map((ev,j)=><span key={j}>{ev}</span>)}</div></div>
       </article>)}
       {turn.response.messages.every(x=>active!=='all'&&x.agent!==active)&&<div className="teamMuted">This specialist did not contribute to the round.</div>}
       <div className="teamRoundFoot">Source: {turn.response.source.name||turn.response.source.mode} · Quality: {turn.response.quality.grade} · Reference candidates: {turn.response.referenceEdgeCandidates} · <b>Not independently verified for wagering</b></div>
      </div>)}
      {busy&&<div className="teamBusy"><span className="teamSpinner"/> Research team checking the available market snapshot and comparing findings…</div>}
      {error&&<div className="teamError" role="alert">{error}</div>}
      <div ref={bottom}/>
     </section>
     <aside className="teamRight" aria-label="Data source and coverage">
      <div className="teamRightTitle">SOURCE INTELLIGENCE</div>
      <div className="teamRightPanel"><span className="teamEyebrow">LATEST OBSERVATION</span><strong>{last?formatTime(last.generatedAt):'No research scan'}</strong><p>{last?.source.name||'Ask a question to inspect the current available provider feeds.'}</p>
       <div className="teamKv"><span>Provider condition</span><b>{last?(last.source.degraded?'DEGRADED':'REPORTED OK'):'UNKNOWN'}</b></div>
       <div className="teamKv"><span>Data state</span><b>{last?.evidenceState||'UNAVAILABLE'}</b></div>
       <div className="teamKv"><span>Independent model</span><b>NOT VERIFIED</b></div>
       <div className="teamKv"><span>Live quote certification</span><b>NOT VERIFIED</b></div>
      </div>
      <div className="teamRightPanel"><span className="teamEyebrow">SPORT COVERAGE</span><p>Only observed market selections appear here. This is not a guaranteed listing of every DraftKings offering.</p>
       {stats?.bySport.length?stats.bySport.slice(0,15).map(x=><div className="teamSport" key={x.sport}><span>{x.sport}<small>{x.leagues} leagues</small></span><b>{x.rows}</b></div>):<p className="teamMuted">No verified sports inventory has been loaded.</p>}
      </div>
      <div className="teamRightPanel"><span className="teamEyebrow">AUDIT CAUTIONS</span>
       {(last?.source.warnings||['No data has been retrieved yet.']).slice(0,4).map((warning,i)=><p className="teamWarning" key={i}>◆ {warning}</p>)}
      </div>
     </aside>
    </div>
    <footer className="teamCompose">
     <form onSubmit={event=>{event.preventDefault();void ask();}}>
      <label htmlFor="team-question">ASK THE RESEARCH TEAM</label>
      <div className="teamInputRow"><textarea id="team-question" aria-label="Your sports research question" placeholder="Ask about a matchup, tennis league, sharp odds, player prop, or missing sport…" maxLength={500} value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void ask();}}} disabled={busy} rows={2}/><button type="submit" disabled={busy||!question.trim()}>{busy?'Researching…':'Ask team ↗'}</button></div>
      <div className="teamComposeFoot"><span>Every specialist reviews the same round. No sportsbook account access or automatic wagering.</span><span>{question.length}/500</span></div>
     </form>
    </footer>
   </main>
  </div>
 </div>;
}
