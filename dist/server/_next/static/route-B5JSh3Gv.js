import{t as e}from"./db-9LtqYd6N.js";import{t}from"./modelPerformance-MBoIKhzt.js";async function n(n){let{searchParams:r}=new URL(n.url),i=r.get(`sport`),a=r.get(`market`),o=e();if(!o)return Response.json({source:`none`,models:[]});let s=await o`
  select occurred_at as "occurredAt",sport,market_key as "marketKey",model_name as "modelName",
   predicted_probability::float as predicted,offered_odds as odds,closing_odds as "closingOdds",outcome
  from historical_predictions
  where outcome is not null
   and (${i}::text is null or sport=${i})
   and (${a}::text is null or market_key=${a})
  order by occurred_at desc
  limit 10000
 `;return Response.json({source:`database`,models:t(s)})}export{n as GET};