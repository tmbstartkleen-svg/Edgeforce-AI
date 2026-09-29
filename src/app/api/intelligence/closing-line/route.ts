import {db} from '@/lib/db';
import {impliedProbability} from '@/lib/math';

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.INGEST_SECRET&&auth!==`Bearer ${process.env.INGEST_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const body=await req.json().catch(()=>({}));
 const {eventId,marketKey,selectionKey,providerId,closingOdds}=body||{};
 if(!eventId||!marketKey||!selectionKey||!Number.isFinite(Number(closingOdds)))return Response.json({ok:false,error:'missing closing line fields'},{status:400});
 const sql=db();
 if(!sql)return Response.json({ok:true,mode:'dry-run',closingProbability:impliedProbability(Number(closingOdds))});
 const rows=await sql`
  insert into closing_line_snapshots(event_id,market_key,selection_key,provider_id,closing_odds,closing_probability)
  values(${eventId},${marketKey},${selectionKey},${providerId??null},${Number(closingOdds)},${impliedProbability(Number(closingOdds))})
  returning id,captured_at as "capturedAt"
 `;
 return Response.json({ok:true,mode:'database',record:rows[0]});
}
