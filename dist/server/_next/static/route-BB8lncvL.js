import{t as e}from"./db-9LtqYd6N.js";var t=e=>e>0?1+e/100:1+100/Math.abs(e);async function n(){let n=e();if(!n)return{configured:!1,rows:[],summary:{pending:0,matched:0,settleable:0,disputed:0}};let r=(await n`
  select
   c.id,c.event_key,c.user_action,c.outcome,c.stake::float8,c.original_odds,
   r.status as resolution_status,r.outcome as resolution_outcome,r.resolution_source
  from cashout_observations c
  left join universal_event_resolutions r on r.event_key=c.event_key
  where c.outcome='PENDING'
  order by c.created_at asc
  limit 1000
 `).map(e=>{let n=String(e.resolution_status||`OPEN`),r=String(e.event_key||``),i=`PENDING`,a=null,o=!1,s=`Waiting for a resolved event truth record.`;return n===`VOID`?(i=`VOID`,a=Number(e.stake),o=!0,s=`Universal event truth marks the event VOID.`):n===`RESOLVED`&&e.resolution_outcome!==null?(i=e.resolution_outcome?`WON`:`LOST`,a=e.resolution_outcome?Number(e.stake)*t(Number(e.original_odds)):0,o=!0,s=`Universal event truth is resolved and can grade the hold counterfactual.`):n===`DISPUTED`?s=`Resolution is disputed; reconciliation is intentionally blocked.`:r||(s=`Observation has no eventKey linkage yet.`),{observationId:Number(e.id),eventKey:r,resolutionStatus:n,resolutionOutcome:e.resolution_outcome===null?null:!!e.resolution_outcome,action:String(e.user_action),currentOutcome:String(e.outcome),proposedOutcome:i,proposedFinalPayout:a,resolutionSource:e.resolution_source?String(e.resolution_source):null,canSettle:o,reason:s}});return{configured:!0,rows:r,summary:{pending:r.length,matched:r.filter(e=>!!e.eventKey&&e.resolutionStatus!==`OPEN`).length,settleable:r.filter(e=>e.canSettle).length,disputed:r.filter(e=>e.resolutionStatus===`DISPUTED`).length}}}async function r(){let t=e();if(!t)return{configured:!1,updated:0,preview:await n()};let r=await n(),i=0;for(let e of r.rows.filter(e=>e.canSettle)){let n=await t`
   update cashout_observations set
    outcome=${e.proposedOutcome},
    final_payout=${e.proposedFinalPayout},
    resolution_source=${e.resolutionSource},
    settled_at=now(),
    updated_at=now()
   where id=${e.observationId} and outcome='PENDING'
   returning id
  `;i+=n.length}return{configured:!0,updated:i,preview:r}}async function i(){let t=e();return t?{configured:!0,rows:await t`
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
 `,totals:(await t`
  select
   count(*) filter(where outcome<>'PENDING')::int as settled,
   count(*) filter(where outcome='PENDING')::int as pending,
   count(*) filter(where outcome='WON')::int as won,
   count(*) filter(where outcome='LOST')::int as lost,
   count(*) filter(where outcome='VOID')::int as void
  from cashout_observations
 `)[0]||{settled:0,pending:0,won:0,lost:0,void:0}}:{configured:!1,rows:[],totals:{settled:0,pending:0,won:0,lost:0,void:0}}}var a=`force-dynamic`;async function o(){let[e,t]=await Promise.all([n(),i()]);return Response.json({ok:!0,generatedAt:new Date().toISOString(),preview:e,summary:t,notes:[`Only RESOLVED or VOID universal truth records can settle a pending cash-out observation.`,`DISPUTED and OPEN events remain untouched.`,`Settlement grades the hold counterfactual; no sportsbook action is executed.`]},{headers:{"Cache-Control":`no-store, max-age=0`}})}async function s(e){if(process.env.INGEST_SECRET&&e.headers.get(`authorization`)!==`Bearer ${process.env.INGEST_SECRET}`)return Response.json({ok:!1,error:`unauthorized`},{status:401});let t=await r();return Response.json({ok:!0,...t})}export{o as GET,s as POST,a as dynamic};