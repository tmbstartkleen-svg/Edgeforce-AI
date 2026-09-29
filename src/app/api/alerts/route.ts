import {db} from '@/lib/db';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({source:'none',alerts:[]});
 const alerts=await sql`
  select id,alert_type as type,severity,market_id as "marketId",message,created_at as "createdAt",resolved_at as "resolvedAt"
  from alerts where resolved_at is null order by created_at desc limit 100
 `;
 return Response.json({source:'database',alerts});
}
