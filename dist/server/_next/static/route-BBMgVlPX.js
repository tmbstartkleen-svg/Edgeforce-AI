import{t as e}from"./db-9LtqYd6N.js";async function t(t){let{searchParams:n}=new URL(t.url),r=Math.min(200,Math.max(1,Number(n.get(`limit`))||50)),i=e();if(!i)return Response.json({source:`none`,entries:[]});let a=await i`
  select id,market_id as "marketId",event_id as "eventId",action,reasons,
   before_state as "beforeState",after_state as "afterState",metadata,created_at as "createdAt"
  from decision_journal order by created_at desc limit ${r}
 `;return Response.json({source:`database`,entries:a})}export{t as GET};