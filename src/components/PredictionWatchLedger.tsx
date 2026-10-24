'use client';
import {useState} from 'react';
type Watch={watch_id:string;kalshi_ticker:string;poly_yes_token:string;poly_no_token:string;minimum_net_roi_pct:number;contract_pairs:number;expiry_at:string|null;enabled:number;settlement_verified:number};
type Observation={observation_id:number;watch_id:string;observed_at:string;minimum_combined_cents:number|null;status:string};
type Ledger={ok:boolean;error?:string;watches?:Watch[];observations?:Observation[];alerts?:{alert_id:number;watch_id:string;status:string;reason:string;first_seen_at:string;delivery_state:string}[];writeEnabled?:boolean};
const date=(x:string)=>{const d=new Date(x);return Number.isFinite(d.getTime())?d.toLocaleString():'—'};
export default function PredictionWatchLedger({operatorToken}:{operatorToken:string}){
 const [data,setData]=useState<Ledger|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [ticker,setTicker]=useState(''),[yes,setYes]=useState(''),[no,setNo]=useState('');
 const [target,setTarget]=useState('2'),[quantity,setQuantity]=useState('100'),[expiry,setExpiry]=useState('2030-12-31');
 const get=async()=>{if(!operatorToken)return;setBusy(true);setError('');try{
  const r=await fetch('/api/operations/prediction-watches',{headers:{authorization:'Bearer '+operatorToken},cache:'no-store'});
  const d:Ledger=await r.json();if(!r.ok||!d.ok){setData(null);setError(d.error||'Watchlist database unavailable')}else setData(d);
 }catch{setError('Cannot load the watchlist')}finally{setBusy(false)}};
 const post=async(payload:Record<string,unknown>)=>{if(!operatorToken)return;setBusy(true);setError('');try{
  const r=await fetch('/api/operations/prediction-watches',{method:'POST',
   headers:{authorization:'Bearer '+operatorToken,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d:{ok:boolean;error?:string;status?:string}=await r.json();if(!r.ok||!d.ok){setError(d.error||'Watch operation blocked');return}
  await get();
 }catch{setError('Watch operation failed')}finally{setBusy(false)}};
 const register=()=>{const id='watch_'+crypto.randomUUID().slice(0,18).replaceAll('-','');
  void post({action:'REGISTER',confirm:'CREATE_DISABLED_WATCH',watchId:id,kalshiTicker:ticker.trim().toUpperCase(),
   polyYesToken:yes.trim(),polyNoToken:no.trim(),minimumNetRoiPct:Number(target),contractPairs:Number(quantity),
   expiryAt:expiry?new Date(expiry+'T23:59:59Z').toISOString():null});
 };
 return <section className="efops-panel">
  <div className="efops-panel-head"><h2>Long-horizon contract watches & observation history</h2><button className="efops-action" disabled={busy||!operatorToken} onClick={()=>void get()}>{busy?'Checking…':'Load saved watches'}</button></div>
  <p>Save exact exchange contracts, a return threshold and a resolution date extending years into the future. New watches are <b>disabled by default</b> and cannot trigger background polling, trading, SMS, or push alerts. The historical ledger records source reviews separately from verified opportunities.</p>
  {error&&<p className="efops-error" role="alert">{error}</p>}
  <div className="efops-grid">
   <label className="efops-field">Kalshi ticker<input value={ticker} onChange={e=>setTicker(e.target.value)} placeholder="Kalshi market ticker"/></label>
   <label className="efops-field">Polymarket YES token<input value={yes} onChange={e=>setYes(e.target.value)} placeholder="YES outcome token ID"/></label>
   <label className="efops-field">Polymarket NO token<input value={no} onChange={e=>setNo(e.target.value)} placeholder="NO outcome token ID"/></label>
   <label className="efops-field">Minimum net ROI (%)<input type="number" value={target} min="0" max="100" step=".1" onChange={e=>setTarget(e.target.value)}/></label>
   <label className="efops-field">Pairs to monitor<input type="number" value={quantity} min="1" step="1" onChange={e=>setQuantity(e.target.value)}/></label>
   <label className="efops-field">Expected resolution date<input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
  </div>
  <button className="efops-action" disabled={!data?.writeEnabled||busy||!ticker||!yes||!no} onClick={register}>Save disabled watch</button>
  <p>Persistence state: <b>{data?.writeEnabled?'Operator write gate configured':'Not enabled'}</b>. Activating writes requires an explicit Cloudflare flag and D1 migration. Saving a watch does not authorize monitoring or exchange fees.</p>
  <div className="efops-tablebox"><table><thead><tr><th>Kalshi contract</th><th>Polymarket tokens</th><th>Threshold</th><th>Expiry</th><th>Activity</th></tr></thead><tbody>
   {(data?.watches||[]).map(w=><tr key={w.watch_id}><td>{w.kalshi_ticker}</td><td>{w.poly_yes_token.slice(0,15)}… / {w.poly_no_token.slice(0,15)}…</td><td>{w.minimum_net_roi_pct}%</td><td>{w.expiry_at?date(w.expiry_at):'Not set'}</td><td><button className="efops-tab" style={{width:'auto'}} disabled={!data?.writeEnabled||busy} onClick={()=>void post({action:'OBSERVE',watchId:w.watch_id,confirm:'CAPTURE_EVIDENCE_ONLY'})}>Capture public book</button></td></tr>)}
  </tbody></table>{!data?.watches?.length&&<p>No watches are recorded in the connected D1 database.</p>}</div>
  <h2>Recorded reviews</h2><div className="efops-tablebox"><table><thead><tr><th>Watch</th><th>Observed</th><th>Lowest quoted pair</th><th>Status</th></tr></thead><tbody>{(data?.observations||[]).map(o=><tr key={o.observation_id}><td>{o.watch_id}</td><td>{date(o.observed_at)}</td><td>{o.minimum_combined_cents===null?'Unavailable':o.minimum_combined_cents.toFixed(2)+'¢'}</td><td>{o.status.replaceAll('_',' ')}</td></tr>)}</tbody></table>{!data?.observations?.length&&<p>No exchange observation receipts recorded.</p>}</div>
  <p className="efops-disclosure">A low quoted pair cost is a review candidate only. The watchlist has no certified fees, fill prices, settlement equivalence, automated monitoring, or delivered notifications. The separate hourly research watch remains outside this dashboard.</p>
 </section>;
}
