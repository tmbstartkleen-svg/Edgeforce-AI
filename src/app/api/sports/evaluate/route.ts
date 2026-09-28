import {demoMarkets} from '@/lib/demo';
import {engineerFeatures} from '@/lib/featureEngineering';
import {sportModel} from '@/lib/sportModels';

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const market=body?.market||demoMarkets.find(x=>x.id===body?.marketId)||demoMarkets[0];
 const features=body?.features||engineerFeatures(market,body?.history||{});
 return Response.json({market,sportModel:sportModel(market,features)});
}
