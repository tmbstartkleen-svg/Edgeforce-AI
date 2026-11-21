'use client';

import type {MarketEntryAuditReport} from '@/lib/marketEntryAuditReport';

const pct=(v:number|null)=>v===null?'Unavailable':(v*100).toFixed(1)+'%';

/** Read-only accuracy panel; never substitutes sample data for actual history. */
export function MarketEntryAccuracyPanel({report}:{report:MarketEntryAuditReport|null}){
 return <section aria-label="Monte entry forecast accuracy" style={{border:'1px solid #64748b',borderRadius:12,padding:16,marginTop:16}}>
  <h2>Monte · Entry forecast accuracy</h2>
  {!report?<p role="status">Historical Kalshi and Polymarket replay is not connected. No verified accuracy results are available.</p>:<>
   <p role="status">Evidence status: {report.status}</p>
   <p>Evaluated forecasts: {report.included} · Excluded: {report.excluded}</p>
   <p>Price-touch Brier score: {report.calibration.touchBrierScore===null?'Unavailable':report.calibration.touchBrierScore.toFixed(4)}</p>
   <p>Observed price-touch rate: {pct(report.calibration.observedTouchRate)}</p>
   <p>Observed fill rate: {pct(report.calibration.observedFillRate)}</p>
   <div style={{overflowX:'auto'}}>
    <table style={{width:'100%',borderCollapse:'collapse',minWidth:320,textAlign:'left'}}>
     <caption style={{textAlign:'left'}}>Probability calibration by predicted touch range</caption>
     <thead><tr><th scope="col">Range</th><th scope="col">Samples</th><th scope="col">Predicted</th><th scope="col">Observed</th></tr></thead>
     <tbody>{report.calibration.calibrationBins.map(b=><tr key={b.lower}>
      <td>{Math.round(b.lower*100)}–{Math.round(b.upper*100)}%</td><td>{b.count}</td>
      <td>{b.count?pct(b.predicted):'—'}</td><td>{b.count?pct(b.observed):'—'}</td>
     </tr>)}</tbody>
    </table>
   </div>
   <p style={{fontSize:12}}>{report.warning}</p>
  </>}
  <p style={{fontSize:12}}>Research only. No guaranteed fills, calibrated execution claims or automatic orders.</p>
 </section>;
}
