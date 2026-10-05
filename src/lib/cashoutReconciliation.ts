import {db} from './db';

export type CashoutReconcileCandidate={
 observationId:number;
 eventKey:string;
 resolutionStatus:string;
 resolutionOutcome:boolean|null;
 action:string;
 currentOutcome:string;
 proposedOutcome:'WON'|'LOST'|'VOID'|'PENDING';
 proposedFinalPayout:number|null;
 resolutionSource:string|null;
 canSettle:boolean;
 reason:string;
};

const decimal=(odds:number)=>odds>0?1+odds/100:1+100/Math.abs(odds);

export async function cashoutReconciliationPreview(){
 const sql=db();
 if(!sql)return {configured:false,rows:[] as CashoutReconcileCandidate[],summary:{pending:0,matched:0,settleable:0,disputed:0}};
 const rows=await sql`
  select
   c.id,c.event_key,c.user_action,c.outcome,c.stake::float8,c.original_odds,
   r.status as resolution_status,r.outcome as resolution_outcome,r.resolution_source
  from cashout_observations c
  left join universal_event_resolutions r on r.event_key=c.event_key
  where c.outcome='PENDING'
  order by c.created_at asc
  limit 1000
 `;
 const mapped:CashoutReconcileCandidate[]=(rows as any[]).map(x=>{
  const status=String(x.resolution_status||'OPEN');
  const eventKey=String(x.event_key||'');
  let proposedOutcome:'WON'|'LOST'|'VOID'|'PENDING'='PENDING';
  let proposedFinalPayout:number|null=null;
  let canSettle=false;
  let reason='Waiting for a resolved event truth record.';
  if(status==='VOID'){
   proposedOutcome='VOID';proposedFinalPayout=Number(x.stake);canSettle=true;reason='Universal event truth marks the event VOID.';
  }else if(status==='RESOLVED'&&x.resolution_outcome!==null){
   proposedOutcome=Boolean(x.resolution_outcome)?'WON':'LOST';
   proposedFinalPayout=Boolean(x.resolution_outcome)?Number(x.stake)*decimal(Number(x.original_odds)):0;
   canSettle=true;reason='Universal event truth is resolved and can grade the hold counterfactual.';
  }else if(status==='DISPUTED'){
   reason='Resolution is disputed; reconciliation is intentionally blocked.';
  }else if(!eventKey){
   reason='Observation has no eventKey linkage yet.';
  }
  return {
   observationId:Number(x.id),eventKey,resolutionStatus:status,resolutionOutcome:x.resolution_outcome===null?null:Boolean(x.resolution_outcome),
   action:String(x.user_action),currentOutcome:String(x.outcome),proposedOutcome,proposedFinalPayout,
   resolutionSource:x.resolution_source?String(x.resolution_source):null,canSettle,reason
  };
 });
 return {
  configured:true,rows:mapped,
  summary:{pending:mapped.length,matched:mapped.filter(x=>Boolean(x.eventKey)&&x.resolutionStatus!=='OPEN').length,settleable:mapped.filter(x=>x.canSettle).length,disputed:mapped.filter(x=>x.resolutionStatus==='DISPUTED').length}
 };
}

export async function reconcileCashoutObservations(){
 const sql=db();
 if(!sql)return {configured:false,updated:0,preview:await cashoutReconciliationPreview()};
 const preview=await cashoutReconciliationPreview();
 let updated=0;
 for(const x of preview.rows.filter(r=>r.canSettle)){
  const result=await sql`
   update cashout_observations set
    outcome=${x.proposedOutcome},
    final_payout=${x.proposedFinalPayout},
    resolution_source=${x.resolutionSource},
    settled_at=now(),
    updated_at=now()
   where id=${x.observationId} and outcome='PENDING'
   returning id
  `;
  updated+=result.length;
 }
 return {configured:true,updated,preview};
}

export async function cashoutSettlementSummary(){
 const sql=db();
 if(!sql)return {configured:false,rows:[],totals:{settled:0,pending:0,won:0,lost:0,void:0}};
 const rows=await sql`
  select
   coalesce(sportsbook,'UNSPECIFIED') as sportsbook,
   user_action,
   count(*)::int as samples,
   count(*) filter(where outcome<>'PENDING')::int as settled,
   avg(model_cashout_edge)::float8 as avg_offer_edge,
   avg(case
    when outcome='PENDING' then null
    when user_action='CASH_OUT' then cashout_offer-final_payout
    when user_action='HOLD' then final_payout-cashout_offer
    else null end)::float8 as avg_realized_advantage
  from cashout_observations
  group by sportsbook,user_action
  order by settled desc,samples desc
  limit 100
 `;
 const totals=await sql`
  select
   count(*) filter(where outcome<>'PENDING')::int as settled,
   count(*) filter(where outcome='PENDING')::int as pending,
   count(*) filter(where outcome='WON')::int as won,
   count(*) filter(where outcome='LOST')::int as lost,
   count(*) filter(where outcome='VOID')::int as void
  from cashout_observations
 `;
 return {configured:true,rows,totals:totals[0]||{settled:0,pending:0,won:0,lost:0,void:0}};
}