import{t as e}from"./db-9LtqYd6N.js";import{n as t,t as n}from"./backtest-C3tJhQT8.js";var r=`force-dynamic`;async function i(r){let{searchParams:i}=new URL(r.url),a=i.get(`sport`),o=i.get(`market`),s=i.get(`model`),c=Math.min(2e4,Math.max(50,Number(i.get(`limit`)||5e3))),l=Math.max(25,Number(i.get(`train`)||100)),u=Math.max(10,Number(i.get(`test`)||25)),d=e();if(!d)return Response.json({source:`none`,summary:n([]),folds:[],rows:0},{headers:{"Cache-Control":`no-store`}});let f=await d`
  select occurred_at as "occurredAt",sport,market_key as "marketKey",model_name as "modelName",
   predicted_probability::float as predicted,offered_odds as odds,closing_odds as "closingOdds",outcome
  from historical_predictions
  where outcome is not null
   and (${a}::text is null or sport=${a})
   and (${o}::text is null or market_key=${o})
   and (${s}::text is null or model_name=${s})
  order by occurred_at asc
  limit ${c}
 `;return Response.json({source:`database`,filters:{sport:a,market:o,model:s,limit:c,trainSize:l,testSize:u},rows:f.length,summary:n(f),folds:t(f,l,u)},{headers:{"Cache-Control":`no-store`}})}export{i as GET,r as dynamic};