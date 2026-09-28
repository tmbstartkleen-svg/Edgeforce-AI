import {demoMarkets} from '@/lib/demo';
import {weekTop30} from '@/lib/scanner';
export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET && auth!==`Bearer ${process.env.CRON_SECRET}`) return Response.json({ok:false},{status:401});
 const rows=weekTop30(demoMarkets);
 return Response.json({ok:true,ranAt:new Date().toISOString(),qualified:rows.length,top:rows.slice(0,10)});
}
