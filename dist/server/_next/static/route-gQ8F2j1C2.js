import{t as e}from"./db-9LtqYd6N.js";async function t(){let t=e();if(!t)return Response.json({source:`none`,moves:[]});let n=await t`
  select market_id as "marketId",trigger_type as "triggerType",
   previous_probability as "previousProbability",
   new_probability as "newProbability",
   previous_ev as "previousEv",
   new_ev as "newEv",
   payload,created_at as "createdAt"
  from repricing_events
  order by created_at desc limit 100
 `;return Response.json({source:`database`,moves:n})}export{t as GET};