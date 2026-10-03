import {loadRecentSteam} from '@/lib/lineMovement';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const limit=Math.max(1,Math.min(200,Number(searchParams.get('limit')||100)));
 const rows=await loadRecentSteam(limit);
 return Response.json({source:rows.length?'database':'none',rows,steamCount:rows.filter((x:any)=>x.steam).length},{headers:{'Cache-Control':'no-store'}});
}
