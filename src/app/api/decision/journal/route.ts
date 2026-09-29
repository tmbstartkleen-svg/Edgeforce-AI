import {db} from '@/lib/db';

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const limit=Math.min(200,Math.max(1,Number(searchParams.get('limit'))||50));
 const sql=db();
 if(!sql)return Response.json({source:'none',entries:[]});
 const entries=await sql`
  select id,market_id as "marketId",event_id as "eventId",action,reasons,
   before_state as "beforeState",after_state as "afterState",metadata,created_at as "createdAt"
  from decision_journal order by created_at desc limit ${limit}
 `;
 return Response.json({source:'database',entries});
}
