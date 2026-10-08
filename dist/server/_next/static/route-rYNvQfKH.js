import{t as e}from"./db-9LtqYd6N.js";var t=`force-dynamic`;async function n(t){let{searchParams:n}=new URL(t.url),r=Math.max(1,Math.min(200,Number(n.get(`limit`)||50))),i=n.get(`marketId`),a=e();if(!a)return Response.json({source:`none`,changes:[]});let o=await a`
  select change_key as id,market_id as "marketId",event_name as event,selection,sport,
   change_type as type,severity,reason,before_value as before,after_value as after,
   requires_resimulation as "requiresResimulation",detected_at as "detectedAt"
  from context_change_events
  where (${i}::text is null or market_id=${i})
  order by detected_at desc
  limit ${r}
 `;return Response.json({source:`database`,changes:o},{headers:{"Cache-Control":`no-store`}})}export{n as GET,t as dynamic};