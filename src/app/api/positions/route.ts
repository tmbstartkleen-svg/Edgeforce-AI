import {db} from '@/lib/db';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({source:'none',positions:[]});
 const positions=await sql`
  select id,event_id as "eventId",market_key as "marketKey",selection_key as "selectionKey",
   sport,stake,odds,model_probability as "modelProbability",
   current_probability as "currentProbability",
   expected_value as "expectedValue",
   current_expected_value as "currentExpectedValue",
   lifecycle_state as "state",opened_at as "openedAt"
  from open_positions where status='open' order by opened_at desc
 `;
 return Response.json({source:'database',positions});
}
