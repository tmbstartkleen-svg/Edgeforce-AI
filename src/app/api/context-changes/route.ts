import {db} from '@/lib/db';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const limit=Math.max(1,Math.min(200,Number(searchParams.get('limit')||50)));
 const marketId=searchParams.get('marketId');
 const sql=db();
 if(!sql)return Response.json({source:'none',changes:[]});
 const rows=await sql`
  select change_key as id,market_id as "marketId",event_name as event,selection,sport,
   change_type as type,severity,reason,before_value as before,after_value as after,
   requires_resimulation as "requiresResimulation",detected_at as "detectedAt"
  from context_change_events
  where (${marketId}::text is null or market_id=${marketId})
  order by detected_at desc
  limit ${limit}
 `;
 return Response.json({source:'database',changes:rows},{headers:{'Cache-Control':'no-store'}});
}
