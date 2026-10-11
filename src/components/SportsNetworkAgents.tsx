'use client';
import {useState} from 'react';
type Agent={
 agentId:string;category:string;enabled:boolean;state:string;nextDueAt:string|null;
 observedAt:string|null;lagMinutes:number|null;sourceRole:string|null;
 sourceIds:string[];lastResult:string;completedRuns:number;consecutiveFailures:number;
 eventCount:number;facts:Record<string,unknown>;lastError:string|null;
};
type Team={ok:boolean;status?:string;enabled?:boolean;scoreScoutEnabled?:boolean;
 agents?:Agent[];asOf?:string;summary?:{agents:number;healthy:number;failed:number;pending:number};
 warning?:string;executedCount?:number;executed?:Array<{agentId:string;status:string;rows:number}>};
const names:Record<string,string>={
 'market-watch':'Odds & market watch',
 'score-watch':'Score history monitor',
 'injury-watch':'Injury intelligence',
 'player-watch':'Player-stat research',
 'forecast-audit':'Simulation & model audit',
 'book-comparison':'Bookmaker comparison',
 'score-scout':'Authorized scoreboard scout'
};
const date=(v:string|null)=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Never';
const text=(v:string)=>v.replaceAll('_',' ').toLowerCase();
export default function SportsNetworkAgents({token}:{token:string}){
 const [data,setData]=useState<Team|null>(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const load=async()=>{
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/network/v1/agents',{cache:'no-store',
    headers:{Authorization:'Bearer '+token}});
   const d=await r.json() as Team;
   if(!r.ok)throw Error(d.status||'Agent history unavailable');
   setData(d);
  }catch(e){setError(e instanceof Error?e.message:'Agent network unavailable')}
  finally{setBusy(false)}
 };
 const run=async()=>{
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/network/v1/agents/dispatch',{
    method:'POST',cache:'no-store',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({maxJobs:2})
   });
   const d=await r.json() as Team;
   if(!r.ok)throw Error(d.status||'Agent run unavailable');
   setNotice((d.executedCount??0)+' specialist runs completed · '+(d.executed||[]).map(x=>names[x.agentId]+' ('+x.status+')').join('; ')||
    'No agents are due. They retain their scheduled database cadence.');
  }catch(e){setError(e instanceof Error?e.message:'Run failed')}
  finally{setBusy(false)}
 };
 return <section className="efAgents" aria-label="EdgeForce autonomous sports network agent team">
  <div className="efWarehouseHead"><div>
   <span className="efKicker">EDGEFORCE NETWORK / MULTI-AGENT OPERATING LAYER / V211</span>
   <h3>Sports intelligence agents</h3>
   <p>Seven focused specialists share our own database, schedules and data-quality checks. All output is source-attributed; bots do not create official scores or sportsbook odds from model text.</p>
  </div><span className="efWarehouseTag">PRIVATE AGENT OPERATIONS</span></div>
  <div className="efAccuracyActions">
   <button disabled={busy||token.length!==64} type="button" onClick={()=>void load()}>Inspect agent health</button>
   <button disabled={busy||token.length!==64||!data?.enabled} type="button" onClick={()=>void run()}>Run up to two due agents</button>
  </div>
  {data&&<div className="efAgentsStats">
   <div><small>Agents registered</small><strong>{data.summary?.agents??0}</strong></div>
   <div><small>Healthy</small><strong>{data.summary?.healthy??0}</strong></div>
   <div><small>Failed</small><strong>{data.summary?.failed??0}</strong></div>
   <div><small>Awaiting first run</small><strong>{data.summary?.pending??0}</strong></div>
  </div>}
  {notice&&<p className="efWarehouseNotice" role="status">{notice}</p>}
  {error&&<p role="alert" className="efChronicleAlert">{error}</p>}
  {data&&<div className="efAgentsGrid">{(data.agents||[]).map(a=><article key={a.agentId}>
   <div className="efAgentsCardTop"><span>{a.category.replaceAll('_',' ')}</span><b>{text(a.state)}</b></div>
   <h4>{names[a.agentId]||a.agentId}</h4>
   <p>Last observation: <b>{date(a.observedAt)}</b> · runs {a.completedRuns} · interval {a.agentId==='score-scout'?120:a.lagMinutes===null?'operator configured':a.lagMinutes+'m since last'}</p>
   <p>Sources: {a.sourceIds.join(', ')||'Not collected'} · Records examined: {a.eventCount}</p>
   <div className="efAgentsFacts">{Object.entries(a.facts||{}).slice(0,6).map(([k,v])=><div key={k}>
    <small>{k.replace(/([A-Z])/g,' $1').replaceAll('_',' ')}</small>
    <b>{typeof v==='object'?(Array.isArray(v)?v.length+' items':'Structured evidence'):String(v).slice(0,120)}</b>
   </div>)}</div>
   <footer>{a.lastResult.replaceAll('_',' ')}{a.lastError?' · Last error '+a.lastError:''} · Next due {date(a.nextDueAt)}</footer>
  </article>)}</div>}
  <p className="efChronicleNotice">{data?.warning||'The network team remains dormant until an owner-issued token, migrations and scheduling are enabled. External scores need separate approved access.'}</p>
 </section>;
}
