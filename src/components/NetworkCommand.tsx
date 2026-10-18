'use client';

import {useCallback,useState} from 'react';
import {NETWORK_ORG,DIRECTORS,type NetworkMember} from '@/lib/networkOrganization';
import type {DirectorRun,DirectorDispatch} from '@/lib/networkDirector';

type Reply=DirectorRun&{
 ok:true;
 coverage:{sports:number;leagues:number;events:number;marketSelections:number;panelQuotes:number;bySport:Array<{sport:string;rows:number;leagues:number}>};
 inputSource:{name:string|null;status:string;warnings:string[]};
 dataQualityCaveat:string;persistence:string;
 durable?:boolean;persisted?:boolean;missionId?:string;
};
type ErrorReply={ok:false;error:string;message:string};
type Exchange={key:number;request:string;response:Reply};
const setup=[
 'ATLAS: Audit our currently observed sports and league coverage. Tell me what feeds and markets are missing.',
 'ATLAS: Coordinate a cross-sport +EV research briefing and have SENTINEL challenge every claim.',
 'ATLAS: Assign the player-intelligence team to investigate today’s prop-data readiness.',
 'ATLAS: Direct the teams to identify what we need to build our own world-class sports information network.'
];
const rankLabel=(role:NetworkMember)=>role.rank==='owner'?'FOUNDER':role.rank==='director'?'CHIEF DIRECTOR':role.rank==='division'?'DIVISION DIRECTOR':'SPECIALIST';
function Badge({message}:{message:DirectorDispatch}){
 return <div className={'networkReport '+(message.status==='FAILED'?'networkFailed':'')}>
  <div className="networkReportHead"><span className="networkInitial">{message.agentName[0]}</span><div><b>{message.agentName}</b><small>{message.stage} / {message.status}</small></div><time>{new Date(message.finishedAt).toLocaleTimeString()}</time></div>
  <p>{message.finding}</p>
  {message.limitations.length>0&&<div className="networkLimit"><strong>Open questions</strong><span>{message.limitations.join(' • ')}</span></div>}
  {message.sources.length>0&&<div className="networkSources">Evidence: {message.sources.join(' · ')}</div>}
  {message.ownerQuestion&&<div className="networkOwnerAsk">Founder question: {message.ownerQuestion}</div>}
 </div>;
}

export default function NetworkCommand(){
 const [auth,setAuth]=useState('');
 const [question,setQuestion]=useState('');
 const [busy,setBusy]=useState(false);
 const [history,setHistory]=useState<Exchange[]>([]);
 const [error,setError]=useState('');
 const [tab,setTab]=useState<'room'|'org'>('room');
 const [selected,setSelected]=useState<string>('atlas');
 const [sequence,setSequence]=useState(0);
 const selectedRole=NETWORK_ORG.find(x=>x.id===selected)||NETWORK_ORG[1];
 const loadHistory=useCallback(async()=>{
  if(!auth.trim()){setError('Enter the Founder access token to restore the private mission journal.');return;}
  if(busy)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/network/missions?limit=15',{
    headers:{'Authorization':'Bearer '+auth.trim()},cache:'no-store'
   });
   const body=await response.json() as {ok:boolean;missions?:Array<{id:string;createdAt:string;request:string;response:Reply}>;message?:string;error?:string};
   if(!response.ok||!body.ok||!Array.isArray(body.missions))throw new Error(body.message||body.error||'Mission history unavailable.');
   const entries=body.missions.filter(item=>item.response?.ok&&Array.isArray(item.response.dispatches));
   setHistory(entries.map((item,index)=>({key:index,request:item.request,response:item.response})));
   setSequence(entries.length);
  }catch(e){setError(e instanceof Error?e.message:'Unable to retrieve saved missions.');}
  finally{setBusy(false);}
 },[auth,busy]);
 const ask=useCallback(async(value?:string)=>{
  const command=(value??question).trim();
  if(!command||busy)return;
  if(!auth.trim()){setError('Enter the private Founder access token configured on your Cloudflare Worker to authorize ATLAS.');return;}
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/network/director',{
    method:'POST',cache:'no-store',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+auth.trim()},
    body:JSON.stringify({question:command})
   });
   const data=await response.json() as Reply|ErrorReply;
   if(!response.ok||!data.ok)throw new Error(!data.ok?(data.message||data.error):'ATLAS request failed.');
   setHistory(prev=>[...prev,{key:sequence,request:command,response:data}].slice(-15));
   setSequence(x=>x+1);setQuestion('');
  }catch(e){setError(e instanceof Error?e.message:'Could not reach director network.');}
  finally{setBusy(false);}
 },[auth,busy,question,sequence]);
 return <div className="networkShell">
  <header className="networkTop">
   <div className="networkName"><div className="networkSymbol">EF</div><div><b>EDGEFORCE</b><small>SPORTS INTELLIGENCE NETWORK</small></div></div>
   <div className="networkIdentity"><span className="networkOwnerMark">♛</span><div><b>FOUNDER & EXECUTIVE CHAIRMAN</b><small>Highest authority • All approvals reserved</small></div></div>
  </header>
  <div className="networkLayout">
   <aside className="networkSidebar">
    <div className="networkSideTitle">EXECUTIVE COMMAND</div>
    <button type="button" onClick={()=>setTab('room')} className={'networkNav '+(tab==='room'?'current':'')}>◈ <span>ATLAS Command Room</span></button>
    <button type="button" onClick={()=>setTab('org')} className={'networkNav '+(tab==='org'?'current':'')}>▦ <span>Organization Chart</span></button>
    <div className="networkSideTitle">DIRECTORS</div>
    {DIRECTORS.map(x=><button type="button" key={x.id} className={'networkMember '+(selected===x.id?'memberSelected':'')} onClick={()=>{setSelected(x.id);setTab('org')}}><span className="networkInitial">{x.name[0]}</span><span><b>{x.name}</b><small>{x.title.replace('Director, ','')}</small></span></button>)}
    <div className="networkAccessNote"><b>FOUNDER CONTROL</b><p>Research only. No deployment, payment, vendor activation, public verified picks, or bets without your explicit approval.</p></div>
   </aside>
   <main className="networkMain">
    {tab==='room'?<>
     <div className="networkHero"><div><div className="networkEyebrow">EXECUTIVE OPERATIONS / CHIEF DIRECTOR</div><h1>ATLAS <span>Command Center</span></h1><p>Give one objective. ATLAS decides which directors investigate, delegates parallel research, receives SENTINEL’s independent challenge, and reports back to you.</p></div><span className="networkStage">OWNER AUTHORIZATION REQUIRED</span></div>
     <div className="networkTeamLine"><div><span className="networkInitial directorMark">A</span><div><strong>ATLAS</strong><small>Chief Director / reports exclusively to you</small></div></div><span>5 research divisions + independent verification</span></div>
     <div className="networkMission">
      <div className="networkMissionTitle">PRIVATE EXECUTIVE AUTHENTICATION</div>
      <p>Your access token stays in this page&apos;s memory; it is not included in research output or saved with conversation history.</p>
      <input value={auth} onChange={e=>setAuth(e.target.value)} type="password" autoComplete="off" placeholder="Founder access token" aria-label="Founder access token"/>
      <button type="button" className="networkRestore" disabled={busy||!auth.trim()} onClick={()=>void loadHistory()}>↺ Restore saved missions</button>
      <small>Requires Worker secrets: EDGEFORCE_NETWORK_OWNER_TOKEN and EDGEFORCE_NETWORK_AI_API_KEY. No default credential exists.</small>
     </div>
     {!history.length&&<div className="networkPrompts"><div className="networkEyebrow">DIRECT ATLAS</div><h2>Your strategic mission, their coordinated execution.</h2><p>ATLAS may ask you questions. The director cannot create facts when odds, models, or licensed data are missing.</p><div>{setup.map(x=><button key={x} type="button" disabled={busy} onClick={()=>void ask(x)}>{x}<span>↗</span></button>)}</div></div>}
     {history.map(entry=><section className="networkExchange" key={entry.key}>
      <div className="networkFounderCommand"><strong>FOUNDER DIRECTIVE</strong><p>{entry.request}</p></div>
      <div className="networkTaskHeader"><span>ATLAS MISSION #{entry.key+1} {entry.response.persisted?'· SAVED':''}</span><small>{new Date(entry.response.generatedAt).toLocaleString()} · {entry.response.sourceState} data</small></div>
      <div className="networkMissionStats">{[
       ['Divisions assigned',entry.response.assignments.length],
       ['Agent reports',entry.response.dispatches.length],
       ['Observed sports',entry.response.coverage.sports],
       ['Observed leagues',entry.response.coverage.leagues]
      ].map(([label,count])=><div key={label}><small>{label}</small><b>{count}</b></div>)}</div>
      <div className="networkStream">
       {entry.response.dispatches.map(message=><Badge key={message.id} message={message}/>)}
      </div>
      <div className="networkDecision"><span>DIRECTOR SUMMARY TO FOUNDER</span><p>{entry.response.summary}</p>{entry.response.ownerQuestion&&<strong>ATLAS asks: {entry.response.ownerQuestion}</strong>}<small>Advisory only · No trades executed · No claims of independently verified +EV from the provisional data</small></div>
     </section>)}
     {busy&&<div className="networkBusy"><span className="networkLoader"/>ATLAS is coordinating director research, evidence review, and independent challenge. This request runs only while connected.</div>}
     {error&&<div className="networkError" role="alert">{error}</div>}
     <form className="networkComposer" onSubmit={e=>{e.preventDefault();void ask();}}>
      <label htmlFor="network-task">DIRECTIVE TO ATLAS</label>
      <div><textarea id="network-task" rows={3} maxLength={500} placeholder="Tell ATLAS what you want the network to research, verify, or plan…" value={question} onChange={e=>setQuestion(e.target.value)} disabled={busy}/><button type="submit" disabled={busy||!question.trim()}>Issue directive ↗</button></div><small>Read-only research. Completed missions are stored in the private Founder journal. Autonomous scheduled agents are not yet enabled.</small>
     </form>
    </>:<>
     <div className="networkHero"><div><div className="networkEyebrow">EXECUTIVE OPERATIONS / STAFF STRUCTURE</div><h1>Network <span>Organization</span></h1><p>One line of accountability: Founder → ATLAS → division directors → specialist agents.</p></div></div>
     <section className="networkOrg">
      <div className="networkOrgNode top"><b>♛ FOUNDER & EXECUTIVE CHAIRMAN</b><small>Ultimate authority / you</small></div>
      <div className="networkConnector">↓</div>
      <div className="networkOrgNode chief"><b>ATLAS — CHIEF DIRECTOR</b><small>Runs missions, delegates research, reports to Founder</small></div>
      <div className="networkConnector">↓</div>
      <div className="networkDirectorGrid">{DIRECTORS.map(x=><button key={x.id} type="button" onClick={()=>setSelected(x.id)} className={'networkOrgNode '+(selected===x.id?'picked':'')}><b>{x.name}</b><small>{x.title}</small><span>{NETWORK_ORG.filter(child=>child.reportsTo===x.id).map(child=>child.name).join(' · ')||'Independent director'}</span></button>)}</div>
      <div className="networkRoleDetail"><span className="networkEyebrow">{rankLabel(selectedRole)} / ASSIGNMENT</span><h2>{selectedRole.name}</h2><p>{selectedRole.mission}</p><div><strong>Reports to:</strong> {NETWORK_ORG.find(x=>x.id===selectedRole.reportsTo)?.name||'Founder'}</div><div><strong>Capability:</strong> {selectedRole.capabilities.join(' · ')}</div></div>
     </section>
    </>}
   </main>
  </div>
 </div>;
}
