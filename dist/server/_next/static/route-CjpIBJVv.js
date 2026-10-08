import{t as e}from"./db-9LtqYd6N.js";async function t(){let t=e();if(!t)return Response.json({source:`none`,routes:[]});let n=await t`
  select route,
   count(*)::int as samples,
   avg(duration_ms)::float as "avgMs",
   percentile_cont(0.95) within group(order by duration_ms)::float as "p95Ms",
   max(duration_ms)::float as "maxMs"
  from performance_samples
  where created_at >= now()-interval '24 hours'
  group by route
  order by "p95Ms" desc
 `;return Response.json({source:`database`,routes:n})}export{t as GET};