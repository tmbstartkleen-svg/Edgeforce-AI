import{t as e}from"./db-9LtqYd6N.js";import{t}from"./backtest-C3tJhQT8.js";import{t as n}from"./dynamicWeights-GAXegAoQ.js";async function r(r){let{searchParams:i}=new URL(r.url),a=i.get(`sport`),o=i.get(`market`);if(!a||!o)return Response.json({error:`sport and market are required`},{status:400});let s=e();if(!s)return Response.json({source:`none`,weights:[]});let c=await s`
  select model_name as "modelName", occurred_at as "occurredAt",
   predicted_probability::float as predicted, offered_odds as odds,
   closing_odds as "closingOdds", outcome
  from historical_predictions
  where sport=${a} and market_key=${o} and outcome is not null
  order by occurred_at asc
 `,l=new Map;for(let e of c){let t=l.get(e.modelName)||[];t.push(e),l.set(e.modelName,t)}let u=[...l.entries()].map(([e,n])=>({modelName:e,summary:t(n)}));return Response.json({source:`database`,sport:a,market:o,weights:n(u)})}export{r as GET};