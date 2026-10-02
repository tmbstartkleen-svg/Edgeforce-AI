import {evaluateReadiness} from '@/lib/readiness';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const url=new URL(req.url);
 const strict=url.searchParams.get('strict')==='1'||url.searchParams.get('strict')==='true';
 const readiness=await evaluateReadiness({strict:strict||undefined});
 return Response.json(readiness,{
  status:readiness.ready?200:503,
  headers:{'Cache-Control':'no-store'}
 });
}
