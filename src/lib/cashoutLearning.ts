import {db} from './db';
import {cashoutDecision} from './cashout';

export type CashoutAction='CASH_OUT'|'HOLD'|'NO_ACTION';
export type CashoutOutcome='WON'|'LOST'|'VOID'|'PENDING';

export type CashoutObservationInput={
 observationId?:number;
 commandId?:string;
 ladderId?:string;
 checkpointLabel?:string;
 stake:number;
 originalOdds:number;
 currentWinProbability:number;
 cashoutOffer:number;
 action:CashoutAction;
 outcome?:CashoutOutcome;
 finalPayout?:number;
 sportsbook?:string;
 metadata?:Record<string,unknown>;
};

export type CashoutLearningRow={
 alertType:'CASHOUT_REVIEW'|'FINAL_LEG_REVIEW';
 samples:number;
 gradedSamples:number;
 positiveSamples:number;
 positiveRate:number;
 averageDecisionUtility:number;
 averageOfferEdge:number;
 confidence:number;
 multiplier:number;
 state:'BOOST'|'NEUTRAL'|'REDUCE'|'UNSCORED';
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const mean=(xs:number[])=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0;

function realizedUtility(x:{stake:number;original_odds:number;cashout_offer:number;action:string;outcome:string|null;final_payout:number|null;current_win_probability:number}){
 const model=cashoutDecision({stake:Number(x.stake),originalOdds:Number(x.original_odds),currentWinProbability:Number(x.current_win_probability),cashoutOffer:Number(x.cashout_offer)});
 const holdRealized=x.outcome==='WON'?Number(x.final_payout??model.grossIfWin):x.outcome==='VOID'?Number(x.stake):0;
 if(x.outcome==='PENDING'||!x.outcome)return null;
 const chosen=x.action==='CASH_OUT'?Number(x.cashout_offer):x.action==='HOLD'?holdRealized:null;
 if(chosen===null)return null;
 const alternative=x.action==='CASH_OUT'?holdRealized:Number(x.cashout_offer);
 const scale=Math.max(1,Number(x.stake));
 return clamp(.5+(chosen-alternative)/(2*scale));
}

export async function recordCashoutObservation(input:CashoutObservationInput){
 const sql=db();
 if(!sql)return {configured:false,written:false};
 const model=cashoutDecision({stake:input.stake,originalOdds:input.originalOdds,currentWinProbability:input.currentWinProbability,cashoutOffer:input.cashoutOffer});
 if(input.observationId){
  const updated=await sql`
   update cashout_observations set
    command_id=coalesce(${input.commandId??null},command_id),
    ladder_id=coalesce(${input.ladderId??null},ladder_id),
    checkpoint_label=coalesce(${input.checkpointLabel??null},checkpoint_label),
    stake=${input.stake},original_odds=${input.originalOdds},current_win_probability=${input.currentWinProbability},
    cashout_offer=${input.cashoutOffer},model_hold_value=${model.adjustedHold},model_cashout_edge=${model.cashoutEdge},
    model_decision=${model.decision},user_action=${input.action},outcome=${input.outcome??'PENDING'},
    final_payout=${input.finalPayout??null},sportsbook=coalesce(${input.sportsbook??null},sportsbook),
    metadata=${sql.json((input.metadata||{}) as any)},updated_at=now()
   where id=${input.observationId}
   returning id
  `;
  return {configured:true,written:updated.length>0,observationId:updated[0]?.id??input.observationId,model};
 }
 const inserted=await sql`
  insert into cashout_observations(
   command_id,ladder_id,checkpoint_label,stake,original_odds,current_win_probability,cashout_offer,
   model_hold_value,model_cashout_edge,model_decision,user_action,outcome,final_payout,sportsbook,metadata,updated_at
  ) values(
   ${input.commandId??null},${input.ladderId??null},${input.checkpointLabel??null},${input.stake},${input.originalOdds},${input.currentWinProbability},${input.cashoutOffer},
   ${model.adjustedHold},${model.cashoutEdge},${model.decision},${input.action},${input.outcome??'PENDING'},${input.finalPayout??null},${input.sportsbook??null},${sql.json((input.metadata||{}) as any)},now()
  ) returning id
 `;
 return {configured:true,written:true,observationId:inserted[0]?.id??null,model};
}

export async function cashoutLearningSummary(){
 const sql=db();
 if(!sql)return {configured:false,rows:[] as CashoutLearningRow[],pending:0};
 const observations=await sql`
  select command_id,checkpoint_label,stake::float8,original_odds,current_win_probability::float8,cashout_offer::float8,
   model_cashout_edge::float8,user_action,outcome,final_payout::float8,created_at
  from cashout_observations
  where created_at >= now() - interval '90 days'
  order by created_at desc
  limit 10000
 `;
 const commandIds=(observations as any[]).map(x=>x.command_id).filter(Boolean);
 const commands=commandIds.length?await sql`
  select command_id,command_type
  from opportunity_command_queue
  where command_id = any(${commandIds})
  order by observed_at desc
 `:[];
 const commandType=new Map<string,string>();
 for(const x of commands as any[])if(!commandType.has(String(x.command_id)))commandType.set(String(x.command_id),String(x.command_type));
 const groups=new Map<string,{utility:number[];edge:number[];samples:number;graded:number;positive:number}>();
 let pending=0;
 for(const raw of observations as any[]){
  const mapped=commandType.get(String(raw.command_id||''));
  const fallbackFinal=String(raw.checkpoint_label||'').toLowerCase().includes('final');
  const type=(mapped==='FINAL_LEG_REVIEW'||(!mapped&&fallbackFinal)?'FINAL_LEG_REVIEW':'CASHOUT_REVIEW') as 'CASHOUT_REVIEW'|'FINAL_LEG_REVIEW';
  const g=groups.get(type)||{utility:[],edge:[],samples:0,graded:0,positive:0};
  g.samples++;
  g.edge.push(Number(raw.model_cashout_edge||0));
  const utility=realizedUtility({stake:Number(raw.stake),original_odds:Number(raw.original_odds),cashout_offer:Number(raw.cashout_offer),action:String(raw.user_action),outcome:raw.outcome?String(raw.outcome):null,final_payout:raw.final_payout===null?null:Number(raw.final_payout),current_win_probability:Number(raw.current_win_probability)});
  if(utility===null){pending++;groups.set(type,g);continue;}
  g.graded++;g.utility.push(utility);if(utility>=.60)g.positive++;groups.set(type,g);
 }
 const types=['CASHOUT_REVIEW','FINAL_LEG_REVIEW'] as const;
 const rows:CashoutLearningRow[]=types.map(alertType=>{
  const g=groups.get(alertType)||{utility:[],edge:[],samples:0,graded:0,positive:0};
  const positiveRate=g.graded?g.positive/g.graded:0;
  const averageDecisionUtility=mean(g.utility);
  const averageOfferEdge=mean(g.edge);
  const confidence=clamp(g.graded/60);
  if(g.graded<8)return {alertType,samples:g.samples,gradedSamples:g.graded,positiveSamples:g.positive,positiveRate,averageDecisionUtility,averageOfferEdge,confidence,multiplier:1,state:'UNSCORED'};
  const shrink=g.graded/(g.graded+40);
  const signal=(averageDecisionUtility-.5)*2;
  const multiplier=.95+clamp(.5+signal*shrink*.5)*.10;
  const state=multiplier>=1.02?'BOOST':multiplier<=.98?'REDUCE':'NEUTRAL';
  return {alertType,samples:g.samples,gradedSamples:g.graded,positiveSamples:g.positive,positiveRate,averageDecisionUtility,averageOfferEdge,confidence,multiplier,state};
 });
 return {configured:true,rows,pending};
}
export async function persistCashoutLearning(rows:CashoutLearningRow[]){
 const sql=db();
 if(!sql||!rows.length)return {persisted:false};
 const latest=await sql`select max(observed_at) as latest from cashout_learning_snapshots`;
 const latestMs=latest[0]?.latest?new Date(latest[0].latest as string).getTime():0;
 if(latestMs&&Date.now()-latestMs<15*60000)return {persisted:false};
 for(const x of rows){
  await sql`
   insert into cashout_learning_snapshots(
    observed_at,alert_type,samples,graded_samples,positive_samples,positive_rate,average_decision_utility,average_offer_edge,confidence,multiplier,state,metadata
   ) values(
    now(),${x.alertType},${x.samples},${x.gradedSamples},${x.positiveSamples},${x.positiveRate},${x.averageDecisionUtility},${x.averageOfferEdge},${x.confidence},${x.multiplier},${x.state},${sql.json({} as any)}
   )
  `;
 }
 return {persisted:true};
}