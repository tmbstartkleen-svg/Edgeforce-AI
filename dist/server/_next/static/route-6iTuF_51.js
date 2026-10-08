import{t as e}from"./db-9LtqYd6N.js";async function t(){let t=e();if(!t)return Response.json({source:`none`,alerts:[]});let n=await t`
  select id,alert_type as type,severity,market_id as "marketId",message,created_at as "createdAt",resolved_at as "resolvedAt"
  from alerts where resolved_at is null order by created_at desc limit 100
 `;return Response.json({source:`database`,alerts:n})}export{t as GET};