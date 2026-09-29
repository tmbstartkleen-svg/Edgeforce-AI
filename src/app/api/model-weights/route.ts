import {normalizedWeights} from '@/lib/dynamicWeights';
export async function POST(req:Request){
  const body=await req.json().catch(()=>({}));
  return Response.json({weights:normalizedWeights(Array.isArray(body?.models)?body.models:[])});
}
