import {db} from '@/lib/db';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({source:'none',providers:[]});
 const providers=await sql`
  select provider_id as id,name,priority,capabilities,enabled,
   last_success_at as "lastSuccessAt",last_failure_at as "lastFailureAt",
   latency_ms as "latencyMs",error_rate as "errorRate"
  from provider_health order by priority desc,name asc
 `;
 return Response.json({source:'database',providers});
}
