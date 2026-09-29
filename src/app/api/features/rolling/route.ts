import {rollingFeaturePack} from '@/lib/rollingFeatures';
export async function POST(req:Request){
  const body=await req.json().catch(()=>({}));
  const rows=Array.isArray(body?.rows)?body.rows:[];
  const keys=Array.isArray(body?.keys)?body.keys:[];
  const window=Math.max(2,Number(body?.window)||5);
  return Response.json({features:rollingFeaturePack(rows,keys,window),window});
}
