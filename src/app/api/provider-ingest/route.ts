import {ingestOdds} from '@/lib/providers/ingest';

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.INGEST_SECRET&&auth!==`Bearer ${process.env.INGEST_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const result=await ingestOdds();
 return Response.json({ok:true,...result});
}
