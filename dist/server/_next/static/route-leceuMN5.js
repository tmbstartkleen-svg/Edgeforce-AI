import{t as e}from"./db-9LtqYd6N.js";async function t(t,{params:n}){let{id:r}=await n,i=Number(r);if(!Number.isFinite(i))return Response.json({ok:!1,error:`invalid id`},{status:400});let a=e();if(!a)return Response.json({ok:!1,error:`database not configured`},{status:503});let o=await a`
  update alerts set resolved_at=now() where id=${i} and resolved_at is null
  returning id,resolved_at as "resolvedAt"
 `;return Response.json({ok:!0,alert:o[0]||null})}export{t as POST};