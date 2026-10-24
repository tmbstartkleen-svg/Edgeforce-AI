'use client';
import {useState} from 'react';
import {evaluateTwoWayArbitrage,twoWayFairPrice,evaluateValueBet} from '@/lib/firstPartyMarketMath';
const field:React.CSSProperties={padding:'12px',borderRadius:8,minWidth:110,width:'100%',background:'#f7fafb',color:'#172330'};
export default function MarketResearchLab(){
 const [a,setA]=useState('+120'),[b,setB]=useState('+120');
 const [capA,setCapA]=useState('100'),[capB,setCapB]=useState('100');
 const [result,setResult]=useState<ReturnType<typeof evaluateTwoWayArbitrage>|null>(null);
 const [fair,setFair]=useState<ReturnType<typeof twoWayFairPrice>|null>(null);
 const [error,setError]=useState('');
 const [singleOdds,setSingleOdds]=useState('+150'),[modelPct,setModelPct]=useState('45');
 const [bankroll,setBankroll]=useState('100'),[kellyFraction,setKellyFraction]=useState('0.25');
 const [valueResult,setValueResult]=useState<ReturnType<typeof evaluateValueBet>|null>(null);
 const [valueError,setValueError]=useState('');
 const calculateValue=()=>{
  setValueError('');setValueResult(null);
  const americanOdds=Number(singleOdds),modelProbability=Number(modelPct)/100;
  const funds=Number(bankroll),fractionalKelly=Number(kellyFraction);
  if(![americanOdds,modelProbability,funds,fractionalKelly].every(Number.isFinite)||!singleOdds.trim()||!modelPct.trim()||!bankroll.trim()||!kellyFraction.trim()){
   setValueError('Enter valid numeric inputs for all fields.');return;
  }
  const nowIso=new Date().toISOString();
  setValueResult(evaluateValueBet({americanOdds,modelProbability,bankroll:funds,fractionalKelly,nowIso,observedAt:nowIso}));
 };
 const evaluate=()=>{setError('');setResult(null);setFair(null);try{
  const oddA=Number(a),oddB=Number(b),stakeA=Number(capA),stakeB=Number(capB);
  if(![oddA,oddB,stakeA,stakeB].every(Number.isFinite))throw Error('Enter finite numerical values.');
  const now=new Date().toISOString();
  setFair(twoWayFairPrice(oddA,oddB));
  setResult(evaluateTwoWayArbitrage([
   {side:'A',americanOdds:oddA,maxStake:stakeA,source:'MANUAL_A',observedAt:now,rulesKey:'MANUAL_ASSUMED_MATCH'},
   {side:'B',americanOdds:oddB,maxStake:stakeB,source:'MANUAL_B',observedAt:now,rulesKey:'MANUAL_ASSUMED_MATCH'}],now));
 }catch(e){setError(e instanceof Error?e.message:'Invalid research inputs');}};
 return <section className="coveragePanel" aria-label="Manual market research calculator" style={{padding:22,marginBottom:20}}>
  <div className="coveragePanelHead"><div><div className="eyebrow">FIRST-PARTY MARKET RESEARCH</div><h2>Fair-price and theoretical arbitrage lab</h2></div></div>
  <p className="coverageNote">Manual hypothetical inputs only. No connected sportsbook price, executable arb, guaranteed edge, model probability or verified settlement-rule comparison is implied. Check the same event, market, outcome, line, terms and executable stakes independently.</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12}}>
   <label>Outcome A American odds<input aria-label="Outcome A odds" style={field} value={a} onChange={e=>setA(e.target.value)}/></label>
   <label>Outcome B American odds<input aria-label="Outcome B odds" style={field} value={b} onChange={e=>setB(e.target.value)}/></label>
   <label>Maximum A stake ($)<input aria-label="Maximum A stake" style={field} value={capA} onChange={e=>setCapA(e.target.value)}/></label>
   <label>Maximum B stake ($)<input aria-label="Maximum B stake" style={field} value={capB} onChange={e=>setCapB(e.target.value)}/></label>
  </div>
  <div className="coverageTools" style={{marginTop:16}}><button type="button" onClick={evaluate}>Calculate research scenario</button><button type="button" onClick={()=>{setA('');setB('');setCapA('');setCapB('');setResult(null);setFair(null);setError('')}}>Clear scenario</button></div>
  {error&&<p role="alert">{error}</p>}
  {fair&&result&&<div aria-live="polite"><div className="coverageKpis">
   <article><small>NO-VIG FAIR PROBABILITY A</small><strong>{(100*fair.fairA).toFixed(2)}%</strong><span>Proportional devig estimate</span></article>
   <article><small>NO-VIG FAIR PROBABILITY B</small><strong>{(100*fair.fairB).toFixed(2)}%</strong><span>Not an independent model</span></article>
   <article><small>THEORETICAL GROSS ROI</small><strong>{result.grossRoi===null?'Unavailable':(result.grossRoi*100).toFixed(2)+'%'}</strong><span>Before fees, limits and slippage</span></article>
   <article><small>QUALIFICATION</small><strong>{result.status==='GROSS_ARBITRAGE'?'Hypothetical only':'Research only'}</strong><span>Not executable or certified</span></article>
  </div><p className="coverageNote">Theoretical allocations: A ${result.stakeA.toFixed(2)} · B ${result.stakeB.toFixed(2)}. {result.reasons.join(', ')||'Gross mathematical condition met, NOT verified in the market.'} {result.warning}</p></div>}
  <div style={{marginTop:28,borderTop:'1px solid #d5dde3',paddingTop:18}}>
   <h2>Break-even, model edge and expected ROI</h2>
   <p className="coverageNote">Manual research scenario. Enter an independently estimated probability; EdgeForce does not infer it from the sportsbook price. The timestamp is the scenario creation time, not a verified sportsbook quote timestamp. No model calibration, available price or profitable edge is certified.</p>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>
    <label>American odds<input aria-label="Value scenario American odds" style={field} value={singleOdds} onChange={e=>setSingleOdds(e.target.value)}/></label>
    <label>Independent model probability (%)<input aria-label="Independent model probability percent" style={field} value={modelPct} onChange={e=>setModelPct(e.target.value)}/></label>
    <label>Research bankroll ($)<input aria-label="Research bankroll" style={field} value={bankroll} onChange={e=>setBankroll(e.target.value)}/></label>
    <label>Kelly fraction (0 to 1)<input aria-label="Kelly fraction" style={field} value={kellyFraction} onChange={e=>setKellyFraction(e.target.value)}/></label>
   </div>
   <div className="coverageTools" style={{marginTop:16}}><button type="button" onClick={calculateValue}>Calculate hypothetical edge</button></div>
   {valueError&&<p role="alert">{valueError}</p>}
   {valueResult&&<div aria-live="polite">
    <div className="coverageKpis">
     <article><small>BREAK-EVEN PROBABILITY</small><strong>{valueResult.breakEvenProbability===null?'Invalid':(valueResult.breakEvenProbability*100).toFixed(2)+'%'}</strong></article>
     <article><small>MODEL PROBABILITY (INPUT)</small><strong>{valueResult.modelProbability===null?'Invalid':(valueResult.modelProbability*100).toFixed(2)+'%'}</strong></article>
     <article><small>ESTIMATED EDGE</small><strong>{valueResult.edgeProbabilityPoints===null?'Invalid':valueResult.edgeProbabilityPoints.toFixed(2)+' pp'}</strong></article>
     <article><small>GROSS EXPECTED ROI</small><strong>{valueResult.grossExpectedRoi===null?'Invalid':(valueResult.grossExpectedRoi*100).toFixed(2)+'%'}</strong></article>
    </div>
    <p className="coverageNote">Theoretical fractional Kelly stake: {valueResult.stake===null?'Unavailable':String.fromCharCode(36)+valueResult.stake.toFixed(2)}. Status: {valueResult.status}. {valueResult.reasons.join(', ')} {valueResult.warning}</p>
   </div>}
  </div>
 </section>;
}
