import {loadSettlementEvidenceHistory} from '@/lib/ledger';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const limit=Math.max(1,Math.min(500,Number(searchParams.get('limit')||100)));
 const history=await loadSettlementEvidenceHistory(limit);
 return Response.json({
  ok:true,
  schemaVersion:'v151-durable-settlement-provenance-1',
  ...history
 },{headers:{'Cache-Control':'no-store'}});
}
