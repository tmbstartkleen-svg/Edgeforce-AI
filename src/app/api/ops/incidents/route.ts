import {db} from '@/lib/db';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({source:'none',incidents:[]});
 const incidents=await sql`
  select id,severity,event_type as "eventType",message,request_id as "requestId",
   metadata,created_at as "createdAt",resolved_at as "resolvedAt"
  from runtime_incidents
  order by created_at desc
  limit 100
 `;
 return Response.json({source:'database',incidents});
}
