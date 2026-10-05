import {db} from './db';

export type CashoutPolicyState='DEFAULT'|'PROVISIONAL'|'LEARNED'|'VERIFIED';
export type CashoutPolicyRow={
 sportsbook:string;
 alertType:'CASHOUT_REVIEW'|'FINAL_LEG_REVIEW';
 samples:number;
 settledSamples:number;
 thresholdEdgePct:number;
 rawBestThresholdPct:number;
 baselineThresholdPct:number;
 classificationAccuracy:number;
 confidence:number;
 state:CashoutPolicyState;
 recommendationBand:{strongCashout:number;cashout:number;neutralLow:number;neutralHigh:number;hold:number};
};

export type CashoutPolicyEvaluation={
 sportsbook:string;
 alertType:'CASHOUT_REVIEW'|'FINAL_LEG_REVIEW';
 edgePct:number;
 learnedThresholdPct:number;
 state:'STRONG_CASHOUT'|'CASHOUT'|'NEUTRAL'|'HOLD';
 confidence:number;
 policyState:CashoutPolicyState;
 reason:string;
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const median=(xs:number[])=>{if(!xs.length)return 0;const s=[...xs].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const decimal=(odds:number)=>odds>0?1+odds/100:1+100/Math.abs(odds);

type Obs={
 sportsbook:string;alertType:'CASHOUT_REVIEW'|'FINAL_LEG_REVIEW';stake:number;originalOdds:number;cashoutOffer:number;
 modelEdge:number;outcome:string;finalPayout:number|null;checkpointLabel:string;
};

function optimalCashout(x:Obs){
 const holdRealized=x.outcome==='WON'?Number(x.finalPayout??x.stake*decimal(x.originalOdds)):x.outcome==='VOID'?x.stake:0;
 return x.cashoutOffer>=holdRealized;
}

function fitThreshold(rows:Obs[]){
 const baseline=.01;
 const candidates=Array.from({length:31},(_,i)=>-.10+i*.01);
 let best=baseline;
 let bestAccuracy=-1;
 for(const threshold of candidates){
  let correct=0;
  for(const x of rows){
   const edgePct=x.stake>0?x.modelEdge/x.stake:0;
   const predicted=edgePct>=threshold;
   if(predicted===optimalCashout(x))correct++;
  }
  const accuracy=rows.length?correct/rows.length:0;
  if(accuracy>bestAccuracy||(accuracy===bestAccuracy&&Math.abs(threshold-baseline)<Math.abs(best-baseline))){best=threshold;bestAccuracy=accuracy;}
 }
 return {best,accuracy:Math.max(0,bestAccuracy)};
}

function policyState(n:number):CashoutPolicyState{
 if(n>=250)return 'VERIFIED';
 if(n>=60)return 'LEARNED';
 if(n>=20)return 'PROVISIONAL';
 return 'DEFAULT';
}

export async function buildCashoutPolicies(){
 const sql=db();
 if(!sql)return {configured:false,rows:[] as CashoutPolicyRow[],evaluations:[] as CashoutPolicyEvaluation[]};
 const raw=await sql`
  select c.sportsbook,c.command_id,c.checkpoint_label,c.stake::float8,c.original_odds,c.cashout_offer::float8,
   c.model_cashout_edge::float8,c.outcome,c.final_payout::float8,q.command_type
  from cashout_observations c
  left join opportunity_command_queue q on q.command_id=c.command_id
  where c.created_at >= now() - interval '180 days'
    and c.outcome <> 'PENDING'
  order by c.created_at desc
  limit 20000
 `;
 const observations:Obs[]=(raw as any[]).map(x=>{
  const mapped=String(x.command_type||'');
  const fallbackFinal=String(x.checkpoint_label||'').toLowerCase().includes('final');
  const alertType=(mapped==='FINAL_LEG_REVIEW'||(!mapped&&fallbackFinal)?'FINAL_LEG_REVIEW':'CASHOUT_REVIEW') as Obs['alertType'];
  return {sportsbook:String(x.sportsbook||'UNSPECIFIED'),alertType,stake:Number(x.stake),originalOdds:Number(x.original_odds),cashoutOffer:Number(x.cashout_offer),modelEdge:Number(x.model_cashout_edge||0),outcome:String(x.outcome),finalPayout:x.final_payout===null?null:Number(x.final_payout),checkpointLabel:String(x.checkpoint_label||'')};
 });
 const groups=new Map<string,Obs[]>();
 for(const x of observations){const key=x.sportsbook+'|'+x.alertType;groups.set(key,[...(groups.get(key)||[]),x]);}
 const rows:CashoutPolicyRow[]=[];
 for(const [key,group] of groups){
  const [sportsbook,alertType]=key.split('|') as [string,Obs['alertType']];
  const {best,accuracy}=fitThreshold(group);
  const n=group.length;
  const shrink=n/(n+80);
  const baseline=.01;
  const threshold=baseline+(best-baseline)*shrink;
  const confidence=clamp(n/100);
  const band=Math.max(.01,.03*(1-confidence));
  rows.push({
   sportsbook,alertType,samples:n,settledSamples:n,thresholdEdgePct:threshold,rawBestThresholdPct:best,baselineThresholdPct:baseline,classificationAccuracy:accuracy,confidence,state:policyState(n),
   recommendationBand:{strongCashout:threshold+.03,cashout:threshold+.01,neutralLow:threshold-band,neutralHigh:threshold+band,hold:threshold-.01}
  });
 }
 rows.sort((a,b)=>b.confidence-a.confidence||b.classificationAccuracy-a.classificationAccuracy||b.samples-a.samples);

 const pending=await sql`
  select c.sportsbook,c.command_id,c.checkpoint_label,c.stake::float8,c.model_cashout_edge::float8,q.command_type
  from cashout_observations c
  left join opportunity_command_queue q on q.command_id=c.command_id
  where c.outcome='PENDING'
  order by c.created_at desc
  limit 1000
 `;
 const policyMap=new Map(rows.map(x=>[x.sportsbook+'|'+x.alertType,x]));
 const evaluations:CashoutPolicyEvaluation[]=(pending as any[]).map(x=>{
  const mapped=String(x.command_type||'');
  const fallbackFinal=String(x.checkpoint_label||'').toLowerCase().includes('final');
  const alertType=(mapped==='FINAL_LEG_REVIEW'||(!mapped&&fallbackFinal)?'FINAL_LEG_REVIEW':'CASHOUT_REVIEW') as Obs['alertType'];
  const sportsbook=String(x.sportsbook||'UNSPECIFIED');
  const exact=policyMap.get(sportsbook+'|'+alertType);
  const global=rows.filter(r=>r.alertType===alertType).sort((a,b)=>b.samples-a.samples)[0];
  const policy=exact||global;
  const threshold=policy?.thresholdEdgePct??.01;
  const confidence=policy?.confidence??0;
  const edgePct=Number(x.stake)>0?Number(x.model_cashout_edge||0)/Number(x.stake):0;
  let state:CashoutPolicyEvaluation['state']='NEUTRAL';
  if(edgePct>=threshold+.03)state='STRONG_CASHOUT';
  else if(edgePct>=threshold+.01)state='CASHOUT';
  else if(edgePct<=threshold-.01)state='HOLD';
  return {sportsbook,alertType,edgePct,learnedThresholdPct:threshold,state,confidence,policyState:policy?.state??'DEFAULT',reason:policy?'Compared with settled '+sportsbook+' / '+alertType+' history.':'No settled policy history; using the baseline 1% edge threshold.'};
 });
 return {configured:true,rows,evaluations};
}

export async function persistCashoutPolicies(rows:CashoutPolicyRow[]){
 const sql=db();
 if(!sql||!rows.length)return {persisted:false};
 const latest=await sql`select max(observed_at) as latest from cashout_policy_snapshots`;
 const latestMs=latest[0]?.latest?new Date(latest[0].latest as string).getTime():0;
 if(latestMs&&Date.now()-latestMs<30*60000)return {persisted:false};
 for(const x of rows){
  await sql`
   insert into cashout_policy_snapshots(
    observed_at,sportsbook,alert_type,samples,settled_samples,threshold_edge_pct,raw_best_threshold_pct,baseline_threshold_pct,classification_accuracy,confidence,state,recommendation_band
   ) values(
    now(),${x.sportsbook},${x.alertType},${x.samples},${x.settledSamples},${x.thresholdEdgePct},${x.rawBestThresholdPct},${x.baselineThresholdPct},${x.classificationAccuracy},${x.confidence},${x.state},${sql.json(x.recommendationBand as any)}
   )
  `;
 }
 return {persisted:true};
}