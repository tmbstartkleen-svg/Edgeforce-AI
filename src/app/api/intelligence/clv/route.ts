import {db} from '@/lib/db';
import {summarizeClv} from '@/lib/clv';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({source:'none',summary:summarizeClv([]),bySport:[]});
 const rows=await sql`
  select sport,offered_odds as "offeredOdds",closing_odds as "closingOdds"
  from historical_predictions
  where closing_odds is not null
  order by occurred_at desc
  limit 5000
 `;
 const bySport=Object.entries(rows.reduce<Record<string,any[]>>((acc:any,r:any)=>{
  (acc[r.sport] ||= []).push(r);
  return acc;
 },{})).map(([sport,items])=>({sport,...summarizeClv(items as any)}));
 return Response.json({source:'database',summary:summarizeClv(rows as any),bySport});
}
