import{t as e}from"./db-9LtqYd6N.js";async function t(){let t=e();if(!t)return Response.json({source:`none`,positions:[]});let n=await t`
  select id,event_id as "eventId",market_key as "marketKey",selection_key as "selectionKey",
   sport,stake,odds,model_probability as "modelProbability",
   current_probability as "currentProbability",
   expected_value as "expectedValue",
   current_expected_value as "currentExpectedValue",
   lifecycle_state as "state",opened_at as "openedAt"
  from open_positions where status='open' order by opened_at desc
 `;return Response.json({source:`database`,positions:n})}export{t as GET};