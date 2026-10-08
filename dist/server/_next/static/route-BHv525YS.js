import{t as e}from"./db-9LtqYd6N.js";import{n as t}from"./providerRegistry-Dx_bR1YU.js";function n(e){let n=t(e.provider).score,r=.5+Math.max(-.1,Math.min(.1,e.historicalClv??0))*5,i=1-Math.max(0,Math.min(.25,e.calibrationError??.08))*4,a=Math.min(1,(e.sampleSize??0)/500),o=Math.max(0,Math.min(1,e.marketAgreement??.75)),s=Math.max(0,Math.min(1,n*.35+r*.2+i*.2+a*.1+o*.15));return{score:s,grade:s>=.85?`A`:s>=.72?`B`:s>=.58?`C`:`D`,health:n,clvScore:r,calibration:i,sample:a,agreement:o}}async function r(){let t=e();if(!t)return Response.json({source:`none`,providers:[]});let r=await t`
  select provider_id as id,name,priority,capabilities,enabled,
   latency_ms as "latencyMs",error_rate as "errorRate"
  from provider_health order by priority desc
 `,i=await t`
  select model_name as "modelName",count(*)::int as n,
   avg(case when closing_odds is not null then
    (case when closing_odds>0 then 1/(1+closing_odds/100.0) else 1/(1+100.0/abs(closing_odds)) end) -
    (case when offered_odds>0 then 1/(1+offered_odds/100.0) else 1/(1+100.0/abs(offered_odds)) end)
   end)::float as clv
  from historical_predictions
  group by model_name
 `,a=new Map(i.map(e=>[e.modelName,e])),o=r.map(e=>{let t=a.get(e.name)||{};return{...e,confidence:n({provider:{...e,capabilities:e.capabilities||[]},historicalClv:t.clv||0,sampleSize:t.n||0,marketAgreement:.8})}});return Response.json({source:`database`,providers:o})}export{r as GET};