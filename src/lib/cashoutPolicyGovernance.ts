import {db} from './db';

export type PolicyRole='CHAMPION'|'CHALLENGER'|'HOLD_BASELINE';
export type PolicyHealth='STABLE'|'DRIFTING'|'REGRESSING'|'INSUFFICIENT';

export type CashoutPolicyGovernanceRow={
 sportsbook:string;
 alertType:'CASHOUT_REVIEW'|'FINAL_LEG_REVIEW';
 samples:number;
 recentSamples:number;
 baselineRegret:number;
 learnedRegret:number;
 regretImprovement:number;
 baselineAccuracy:number;
 learnedAccuracy:number;
 accuracyLift:number;
 recentLearnedRegret:number;
 driftScore:number;
 confidence:number;
 role:PolicyRole;
 health:PolicyHealth;
 promoted:boolean;
 reason:string;
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const mean=(xs:number[])=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0;
const decimal=(odds:number)=>odds>0?1+odds/100:1+100/Math.abs(odds);

type Obs={
 sportsbook:string;alertType:'CASHOUT_REVIEW'|'FINAL_LEG_REVIEW';stake:number;originalOdds:number;cashoutOffer:number;
 modelEdge:number;outcome:string;finalPayout:number|null;createdAt:string;
};

function realizedHold(x:Obs){
 if(x.outcome==='VOID')return x.stake;
 if(x.outcome==='WON')return Number(x.finalPayout??x.stake*decimal(x.originalOdds));
 return 0;
}

function actionValue(x:Obs,cashout:boolean){return cashout?x.cashoutOffer:realizedHold(x);}

function optimalValue(x:Obs){return Math.max(x.cashoutOffer,realizedHold(x));}

function regretForThreshold(rows:Obs[],threshold:number){
 const regrets:number[]=[];
 let correct=0;
 for(const x of rows){
  const edgePct=x.stake>0?x.modelEdge/x.stake:0;
  const chooseCashout=edgePct>=threshold;
  const chosen=actionValue(x,chooseCashout);
  const optimal=optimalValue(x);
  regrets.push(x.stake>0?(optimal-chosen)/x.stake:0);
  const optimalCashout=x.cashoutOffer>=realizedHold(x);
  if(chooseCashout===optimalCashout)correct++;
 }
 return {regret:mean(regrets),accuracy:rows.length?correct/rows.length:0};
}

function fitThreshold(rows:Obs[]){
 const baseline=.01;
 const candidates=Array.from({length:31},(_,i)=>-.10+i*.01);
 let best=baseline;
 let bestRegret=Infinity;
 for(const threshold of candidates){
  const metric=regretForThreshold(rows,threshold);
  if(metric.regret<bestRegret||(metric.regret===bestRegret&&Math.abs(threshold-baseline)<Math.abs(best-baseline))){best=threshold;bestRegret=metric.regret;}
 }
 const shrink=rows.length/(rows.length+80);
 return baseline+(best-baseline)*shrink;
}

export async function buildCashoutPolicyGovernance(){
 const sql=db();
 if(!sql)return {configured:false,rows:[] as CashoutPolicyGovernanceRow[],summary:{champions:0,challengers:0,baseline:0,drifting:0}};
 const raw=await sql`
  select c.sportsbook,c.command_id,c.checkpoint_label,c.stake::float8,c.original_odds,c.cashout_offer::float8,
   c.model_cashout_edge::float8,c.outcome,c.final_payout::float8,c.created_at,q.command_type
  from cashout_observations c
  left join opportunity_command_queue q on q.command_id=c.command_id
  where c.created_at >= now() - interval '365 days'
    and c.outcome <> 'PENDING'
  order by c.created_at asc
  limit 50000
 `;
 const observations:Obs[]=(raw as any[]).map(x=>{
  const mapped=String(x.command_type||'');
  const fallbackFinal=String(x.checkpoint_label||'').toLowerCase().includes('final');
  const alertType=(mapped==='FINAL_LEG_REVIEW'||(!mapped&&fallbackFinal)?'FINAL_LEG_REVIEW':'CASHOUT_REVIEW') as Obs['alertType'];
  return {sportsbook:String(x.sportsbook||'UNSPECIFIED'),alertType,stake:Number(x.stake),originalOdds:Number(x.original_odds),cashoutOffer:Number(x.cashout_offer),modelEdge:Number(x.model_cashout_edge||0),outcome:String(x.outcome),finalPayout:x.final_payout===null?null:Number(x.final_payout),createdAt:String(x.created_at)};
 });
 const groups=new Map<string,Obs[]>();
 for(const x of observations){const key=x.sportsbook+'|'+x.alertType;groups.set(key,[...(groups.get(key)||[]),x]);}
 const rows:CashoutPolicyGovernanceRow[]=[];
 for(const [key,group] of groups){
  const [sportsbook,alertType]=key.split('|') as [string,Obs['alertType']];
  const baseline=.01;
  const learned=fitThreshold(group);
  const baselineMetrics=regretForThreshold(group,baseline);
  const learnedMetrics=regretForThreshold(group,learned);
  const cutoff=Date.now()-30*24*3600000;
  const recent=group.filter(x=>new Date(x.createdAt).getTime()>=cutoff);
  const recentMetrics=recent.length?regretForThreshold(recent,learned):learnedMetrics;
  const regretImprovement=baselineMetrics.regret-learnedMetrics.regret;
  const accuracyLift=learnedMetrics.accuracy-baselineMetrics.accuracy;
  const driftScore=Math.max(0,recentMetrics.regret-learnedMetrics.regret);
  const confidence=clamp(group.length/150);
  let health:PolicyHealth='INSUFFICIENT';
  if(group.length>=40){
   if(regretImprovement<0)health='REGRESSING';
   else if(recent.length>=15&&driftScore>.03)health='DRIFTING';
   else health='STABLE';
  }
  let role:PolicyRole='HOLD_BASELINE';
  let promoted=false;
  if(group.length>=120&&regretImprovement>=.01&&accuracyLift>=0&&health==='STABLE'){role='CHAMPION';promoted=true;}
  else if(group.length>=40&&regretImprovement>0&&health!=='REGRESSING'){role='CHALLENGER';}
  const reason=role==='CHAMPION'
   ?'Learned policy clears sample, regret, accuracy and drift gates.'
   :role==='CHALLENGER'
    ?'Learned policy shows promise but has not cleared full promotion gates.'
    :health==='REGRESSING'
     ?'Learned policy underperforms the 1% baseline on settled regret.'
     :health==='DRIFTING'
      ?'Recent regret has worsened enough to block promotion.'
      :'Insufficient evidence to replace the 1% baseline.';
  rows.push({sportsbook,alertType,samples:group.length,recentSamples:recent.length,baselineRegret:baselineMetrics.regret,learnedRegret:learnedMetrics.regret,regretImprovement,baselineAccuracy:baselineMetrics.accuracy,learnedAccuracy:learnedMetrics.accuracy,accuracyLift,recentLearnedRegret:recentMetrics.regret,driftScore,confidence,role,health,promoted,reason});
 }
 rows.sort((a,b)=>(b.promoted?1:0)-(a.promoted?1:0)||b.regretImprovement-a.regretImprovement||b.samples-a.samples);
 return {configured:true,rows,summary:{champions:rows.filter(x=>x.role==='CHAMPION').length,challengers:rows.filter(x=>x.role==='CHALLENGER').length,baseline:rows.filter(x=>x.role==='HOLD_BASELINE').length,drifting:rows.filter(x=>x.health==='DRIFTING'||x.health==='REGRESSING').length}};
}

export async function persistCashoutPolicyGovernance(rows:CashoutPolicyGovernanceRow[]){
 const sql=db();
 if(!sql||!rows.length)return {persisted:false};
 const latest=await sql`select max(observed_at) as latest from cashout_policy_governance_snapshots`;
 const latestMs=latest[0]?.latest?new Date(latest[0].latest as string).getTime():0;
 if(latestMs&&Date.now()-latestMs<60*60000)return {persisted:false};
 for(const x of rows){
  await sql`
   insert into cashout_policy_governance_snapshots(
    observed_at,sportsbook,alert_type,samples,recent_samples,baseline_regret,learned_regret,regret_improvement,baseline_accuracy,learned_accuracy,accuracy_lift,recent_learned_regret,drift_score,confidence,role,health,promoted,reason
   ) values(
    now(),${x.sportsbook},${x.alertType},${x.samples},${x.recentSamples},${x.baselineRegret},${x.learnedRegret},${x.regretImprovement},${x.baselineAccuracy},${x.learnedAccuracy},${x.accuracyLift},${x.recentLearnedRegret},${x.driftScore},${x.confidence},${x.role},${x.health},${x.promoted},${x.reason}
   )
  `;
 }
 return {persisted:true};
}