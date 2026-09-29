import {db} from '@/lib/db';

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.INGEST_SECRET && auth!==`Bearer ${process.env.INGEST_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const body=await req.json().catch(()=>({}));
 const rows=Array.isArray(body)?body:Array.isArray(body?.rows)?body.rows:[];
 const sql=db();
 if(!sql)return Response.json({ok:true,mode:'dry-run',received:rows.length});
 let written=0;
 for(const r of rows){
  await sql`
   insert into historical_predictions(
    occurred_at,sport,market_key,selection_key,model_name,model_version,
    predicted_probability,offered_odds,closing_odds,outcome,features
   ) values(
    ${r.occurredAt},${r.sport},${r.marketKey},${r.selectionKey??null},${r.modelName},
    ${r.modelVersion??process.env.MODEL_VERSION??'edgeforce-v9'},${r.predicted},
    ${r.odds},${r.closingOdds??null},${r.outcome??null},${sql.json(r.features||{})}
   )
  `;
  written++;
 }
 return Response.json({ok:true,mode:'database',written});
}
