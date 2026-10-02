import {evaluateReadiness} from '@/lib/readiness';

export const dynamic='force-dynamic';

export async function GET(){
 const readiness=await evaluateReadiness();
 return Response.json(readiness,{
  status:readiness.ready?200:503,
  headers:{'Cache-Control':'no-store'}
 });
}
