import{t as e}from"./db-9LtqYd6N.js";async function t(){let t=e();if(!t)return Response.json({source:`none`,incidents:[]});let n=await t`
  select id,severity,event_type as "eventType",message,request_id as "requestId",
   metadata,created_at as "createdAt",resolved_at as "resolvedAt"
  from runtime_incidents
  order by created_at desc
  limit 100
 `;return Response.json({source:`database`,incidents:n})}export{t as GET};