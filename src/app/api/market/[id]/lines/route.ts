import {db} from '@/lib/db';

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const sql=db();
 if(!sql)return Response.json({source:'none',points:[]});
 const points=await sql`
  select market_key as "marketKey",selection_key as "selectionKey",
   american_odds as odds,implied_probability as "impliedProbability",
   pulled_at as "pulledAt"
  from market_snapshots
  where event_id=${id}
  order by pulled_at asc
  limit 500
 `;
 return Response.json({source:'database',points});
}
