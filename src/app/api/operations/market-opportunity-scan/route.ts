import {scanArbitrage,screenValueEdges} from '@/lib/intelligence-core/market-opportunity-engine.mjs';
export const dynamic='force-dynamic';
/** Owner-only analysis of client supplied verified source observations. No network requests or bets. */
export async function POST(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return Response.json({ok:false,reason:'NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{
  const body=await request.json();
  if(!body||typeof body!=='object'||Array.isArray(body)||!Array.isArray(body.quotes)||body.quotes.length>10000||
   (body.forecasts!==undefined&&(!Array.isArray(body.forecasts)||body.forecasts.length>5000)))throw Error('INVALID_INPUT');
  const arb=scanArbitrage(body.quotes,{bankroll:body.bankroll??100});
  const edges=screenValueEdges(body.quotes,body.forecasts??[]);
  return Response.json({ok:true,mode:'EVIDENCE_ONLY_OPPORTUNITY_SCAN',arbitrage:arb,value:edges,
   disclaimer:'Theoretical opportunities require independent live venue confirmation, fees, limits, liquidity and settlement verification before use.',
   ordersPlaced:0,externalApiRequests:0,databaseWrites:0},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({ok:false,reason:'INVALID_OPPORTUNITY_SCAN'},{status:400,headers:{'Cache-Control':'no-store'}})}
}
