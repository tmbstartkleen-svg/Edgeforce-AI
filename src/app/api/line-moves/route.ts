import {db} from '@/lib/db';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({source:'none',moves:[]});
 const moves=await sql`
  select market_id as "marketId",trigger_type as "triggerType",
   previous_probability as "previousProbability",
   new_probability as "newProbability",
   previous_ev as "previousEv",
   new_ev as "newEv",
   payload,created_at as "createdAt"
  from repricing_events
  order by created_at desc limit 100
 `;
 return Response.json({source:'database',moves});
}
