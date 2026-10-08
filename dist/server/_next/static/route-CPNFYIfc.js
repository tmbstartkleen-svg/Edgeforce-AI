import{t as e}from"./db-9LtqYd6N.js";import{t}from"./forecastResearchLab-CaR0q7vK.js";var n=`force-dynamic`;async function r(n){let{searchParams:r}=new URL(n.url),i=r.get(`sport`),a=r.get(`market`),o=r.get(`model`),s=Math.max(1,Math.min(3650,Number(r.get(`days`)||365))),c=Math.max(50,Math.min(2e4,Number(r.get(`limit`)||5e3))),l=e();if(!l)return Response.json({ok:!0,source:`none`,filters:{sport:i,market:a,model:o,days:s,limit:c},report:t([])},{headers:{"Cache-Control":`no-store`}});let u=(await l`
  select
   occurred_at as "occurredAt",
   sport,
   market_key as "marketKey",
   model_name as "modelName",
   model_version as "modelVersion",
   selection_key as "selectionKey",
   predicted_probability::float as predicted,
   offered_odds as odds,
   outcome,
   features
  from historical_predictions
  where outcome is not null
   and occurred_at>=now()-make_interval(days=>${s})
   and (${i}::text is null or sport=${i})
   and (${a}::text is null or market_key=${a})
   and (${o}::text is null or model_name=${o})
  order by occurred_at asc
  limit ${c}
 `).map(e=>({occurredAt:new Date(e.occurredAt).toISOString(),sport:String(e.sport),marketKey:String(e.marketKey),modelName:String(e.modelName),modelVersion:e.modelVersion?String(e.modelVersion):void 0,selectionKey:e.selectionKey?String(e.selectionKey):void 0,predicted:Number(e.predicted),odds:Number(e.odds||0),outcome:Number(e.outcome),features:e.features&&typeof e.features==`object`?e.features:{}}));return Response.json({ok:!0,source:`database`,filters:{sport:i,market:a,model:o,days:s,limit:c},rows:u.length,report:t(u)},{headers:{"Cache-Control":`no-store`}})}export{r as GET,n as dynamic};