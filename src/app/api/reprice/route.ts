import {demoMarkets} from '@/lib/demo';
import {repriceMarket} from '@/lib/repricing';
export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const market=demoMarkets.find(x=>x.id===body?.marketId)||demoMarkets[0];
 const repriced=repriceMarket(market,{injury:body?.injury,weather:body?.weather,homeAdvantage:body?.homeAdvantage,lineMovePct:body?.lineMovePct});
 return Response.json({original:market,repriced});
}
