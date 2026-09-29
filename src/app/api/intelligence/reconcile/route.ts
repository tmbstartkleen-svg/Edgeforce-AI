import {reconcileProviderPrices} from '@/lib/providerReconciliation';

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const prices=Array.isArray(body?.prices)?body.prices:[];
 return Response.json({result:reconcileProviderPrices(prices)});
}
