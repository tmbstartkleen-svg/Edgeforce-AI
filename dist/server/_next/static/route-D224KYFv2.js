import{t as e}from"./db-9LtqYd6N.js";import{n as t}from"./modelCalibration-BEmX_mN5.js";async function n(n){let{searchParams:r}=new URL(n.url),i=r.get(`sport`),a=r.get(`market`),o=r.get(`model`),s=e();if(!s)return Response.json({source:`none`,profiles:[]});let c=await s`
  select occurred_at as "occurredAt",sport,market_key as "marketKey",model_name as "modelName",
   predicted_probability::float as predicted,offered_odds as odds,closing_odds as "closingOdds",outcome
  from historical_predictions
  where outcome is not null
   and (${i}::text is null or sport=${i})
   and (${a}::text is null or market_key=${a})
   and (${o}::text is null or model_name=${o})
  order by occurred_at desc
  limit 10000
 `,l=new Map;for(let e of c){let t=[e.sport,e.marketKey,e.modelName].join(`|`),n=l.get(t)||[];n.push(e),l.set(t,n)}let u=[...l.entries()].map(([e,n])=>{let[r,i,a]=e.split(`|`);return{sport:r,marketKey:i,modelName:a,...t(n)}});return Response.json({source:`database`,profiles:u})}export{n as GET};