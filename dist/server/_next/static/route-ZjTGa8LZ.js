import{t as e}from"./db-9LtqYd6N.js";async function t(){let t=e();if(!t)return Response.json({source:`none`,cells:[]});let n=await t`
  select sport,market_key as "marketKey",predicted_probability as p,outcome
  from historical_predictions
  where outcome is not null
  order by occurred_at desc
  limit 10000
 `,r=new Map;for(let e of n){let t=Math.min(9,Math.max(0,Math.floor(Number(e.p)*10))),n=[e.sport,e.marketKey,t].join(`|`),i=r.get(n)||{sport:e.sport,marketKey:e.marketKey,bucket:t,n:0,pred:0,actual:0};i.n++,i.pred+=Number(e.p),i.actual+=Number(e.outcome),r.set(n,i)}let i=[...r.values()].map(e=>({...e,pred:e.pred/e.n,actual:e.actual/e.n,error:(e.pred-e.actual)/e.n}));return Response.json({source:`database`,cells:i})}export{t as GET};