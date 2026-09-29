import {db} from '@/lib/db';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({source:'none',routes:[]});
 const routes=await sql`
  select route,
   count(*)::int as samples,
   avg(duration_ms)::float as "avgMs",
   percentile_cont(0.95) within group(order by duration_ms)::float as "p95Ms",
   max(duration_ms)::float as "maxMs"
  from performance_samples
  where created_at >= now()-interval '24 hours'
  group by route
  order by "p95Ms" desc
 `;
 return Response.json({source:'database',routes});
}
