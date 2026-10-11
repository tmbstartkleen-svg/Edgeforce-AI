'use client';
import {useState} from 'react';
import SportsArchiveWarehouse from './SportsArchiveWarehouse';
type Era='past'|'present'|'future';
type Item={eventId:string;sport:string;league:string;home:string;away:string;startTime:string|null;market?:string|null;selection?:string|null;bookmaker?:string|null;provider?:string|null;observedAt?:string|null;ageSeconds?:number|null;status?:string;odds?:number|null;offeredOdds?:number|null;settlementReferenceAvailable?:boolean;probability?:number|null;forecastEvidence?:string;monteCarloInterval?:[number,number]|null;modelVersion?:string;calibrationSample?:number|null;reasons?:string[]};
type Result={ok:boolean;era?:Era;status?:string;entries?:Item[];coverage?:Record<string,number>;asOf?:string;warning?:string};
const date=(v:string|null|undefined)=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Unverified';
const prob=(v:number|null|undefined)=>typeof v==='number'&&Number.isFinite(v)?(v*100).toFixed(1)+'%':'Unknown';
const odds=(v:number|null|undefined)=>typeof v==='number'&&Number.isSafeInteger(v)?(v>0?'+':'')+v:'No verified price';
export default function SportsNetworkChronicle(){
 const [era,setEra]=useState<Era>('past');
 const [sport,setSport]=useState('ALL');
 const [token,setToken]=useState('');
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<Result|null>(null);
 const [error,setError]=useState('');
 const select=(v:Era)=>{setEra(v);setResult(null);setError('')};
 const load=async()=>{
  if(busy)return;
  setBusy(true);setError('');
  try{
   const params=new URLSearchParams({era,...(sport==='ALL'?{}:{sport})});
   const response=await fetch('/api/network/v1/intelligence?'+params,{cache:'no-store',headers:{Authorization:'Bearer '+token}});
   const data=await response.json() as Result;
   if(!response.ok){setResult(null);setError(data.status==='NETWORK_KEY_NOT_CONFIGURED'?'Owner network authentication has not been activated in Cloudflare.':data.status==='UNAUTHORIZED'?'Private token is invalid or missing.':data.status||'Archive unavailable.')}
   else setResult(data);
  }catch{setResult(null);setError('Research request could not be completed. No automatic retry was sent.')}
  finally{setBusy(false)}
 };
 return <section className="efChronicle" id="sports-network" aria-label="EdgeForce Sports Network">
  <div className="efChronicleHero">
   <span className="efKicker">EDGEFORCE SPORTS NETWORK / V207</span>
   <h2>Past records. Present signals. <em>Future probabilities.</em></h2>
   <p>Our first-party research network separates what sources observed from what predictive models estimate. No manufactured odds, final scores, or simulated certainty.</p>
   <div className="efChronicleTriad"><span><b>PAST</b> Historical evidence</span><span><b>PRESENT</b> Time-stamped markets</span><span><b>FUTURE</b> Calibrated forecasts</span></div>
  </div>
  <div className="efChronicleAccess">
   <div><b>Private owner access</b><p>The 64-character EdgeForce network key is needed to inspect internal records. It is not saved, and this screen never polls data automatically.</p></div>
   <label>Network access token<input type="password" value={token} autoComplete="off" placeholder="Private first-party bearer token" onChange={e=>setToken(e.target.value)}/></label>
  </div>
  <nav className="efChronicleTabs" aria-label="Past, present and future">
   {([['past','Past / 90 days'],['present','Present / 36 hours'],['future','Future / 7 days']] as const).map(([v,title])=><button type="button" key={v} aria-pressed={era===v} onClick={()=>select(v)}>{title}</button>)}
  </nav>
  <div className="efChronicleFilters">
   <label>Sport or league (ALL = every stored sport)
    <input list="efChronicleSports" maxLength={28} value={sport} onChange={e=>{setSport(e.target.value);setResult(null)}} placeholder="ALL or any stored league"/>
    <datalist id="efChronicleSports">{['ALL','NFL','NCAAF','NBA','WNBA','NCAAB','MLB','NHL','MLS','EPL','UFC','TENNIS','TABLE TENNIS','CRICKET','ESPORTS'].map(v=><option key={v} value={v}/>)}</datalist>
   </label>
   <button type="button" onClick={()=>void load()} disabled={busy||token.length!==64}>{busy?'Checking archive…':'Inspect '+era+' records'}</button>
  </div>
  {error&&<p role="alert" className="efChronicleAlert">{error}</p>}
  {result&&<div className="efChronicleResults">
   <div className="efChronicleResultHead"><div><span className="efKicker">SOURCE-VERIFIED EVIDENCE / {era.toUpperCase()}</span><h3>{result.entries?.length||0} records</h3><small>As of {date(result.asOf)} · maximum 50 per query · stored records only</small></div><span>READ-ONLY RESEARCH</span></div>
   {!!result.coverage&&<div className="efChronicleCoverage">{Object.entries(result.coverage).map(([key,n])=><div key={key}><small>{key.replace(/([A-Z])/g,' $1')}</small><b>{n}</b></div>)}</div>}
   <p className="efChronicleNotice">{result.warning}</p>
   <div className="efChronicleCards">{result.entries?.map((r,i)=><article key={r.eventId+'-'+i}>
    <div className="efChronicleCardTop"><small>{r.sport} · {r.league}</small><small>{date(r.startTime)}</small></div>
    <h4>{r.away||'Away unverified'} <span>at</span> {r.home||'Home unverified'}</h4>
    <p>{r.market||'No market recorded'} · {r.selection||'No selection recorded'}</p>
    {era==='past'&&<><strong>{odds(r.offeredOdds)}</strong><small>{r.provider||'Source unknown'} / {r.bookmaker||'Book unverified'} · observed {date(r.observedAt)}</small><div className="efChronicleEvidence">Final result not verified · Settled bet references: {r.settlementReferenceAvailable?'present':'not stored'}</div></>}
    {era==='present'&&<><strong>{odds(r.odds)}</strong><small>{r.provider||'Source unknown'} / {r.bookmaker||'Book unverified'}</small><div className="efChronicleEvidence">{r.status?.replaceAll('_',' ')||'Not verified'} · age {r.ageSeconds===null||r.ageSeconds===undefined?'unknown':r.ageSeconds+'s'} · not executable</div></>}
    {era==='future'&&<><strong>{prob(r.probability)}</strong><small>{r.modelVersion||'Unverified model'} · sampling interval {r.monteCarloInterval?.map(prob).join('–')||'not established'}</small><div className="efChronicleEvidence">{r.forecastEvidence?.replaceAll('_',' ')||'Not verified'} · calibration {r.calibrationSample??'unknown'} · no trade approval</div>{!!r.reasons?.length&&<details><summary>Model limitations</summary>{r.reasons.map(v=><p key={v}>{v}</p>)}</details>}</>}
   </article>)}</div>
   {!result.entries?.length&&<p className="efChronicleNotice">No records are available for this period and sport. That is a data coverage gap, not proof of no games.</p>}
  </div>}
  <SportsArchiveWarehouse token={token} sport={sport}/>
  <p className="efChronicleFooter">Authorized external sources remain necessary for official game results and bookmaker quotes. Our network owns the storage and analysis, not the upstream data licenses.</p>
 </section>;
}
