import {lineMovementSeries,matchedNoVig} from '@/lib/intelligence-core/market-identity-and-movement.mjs';
export const dynamic='force-dynamic';
/** Operator-provided observation analysis, no provider polling or storage mutations. */
export async function POST(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return Response.json({ok:false,reason:'NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{
  const body=await request.json();
  if(!body||!Array.isArray(body.quotes)||body.quotes.length>10000)throw Error('INVALID_INPUT');
  const movements=lineMovementSeries(body.quotes);
  const noVig=matchedNoVig(body.quotes);
  return Response.json({ok:true,mode:'READ_ONLY_PRICE_HISTORY_ANALYSIS',movements,noVig,
   certifiedClosingLines:0,networkRequests:0,databaseWrites:0},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({ok:false,reason:'INVALID_PRICE_OBSERVATIONS'},{status:400,headers:{'Cache-Control':'no-store'}})}
}
