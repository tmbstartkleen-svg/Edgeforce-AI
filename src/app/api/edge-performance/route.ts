import {summarizeEdgePerformance,type SettledEdgePick} from '@/lib/edgePerformanceLedger';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 let body:unknown;
 try{body=await request.json();}catch{return Response.json({ok:false,error:'INVALID_JSON'},{status:400});}
 if(!body||typeof body!=='object')return Response.json({ok:false,error:'INVALID_INPUT'},{status:400});
 const input=body as {rows?:unknown};
 if(!Array.isArray(input.rows)||input.rows.length>10000)return Response.json({ok:false,error:'INVALID_ROWS'},{status:400});
 const valid=input.rows.every((row:unknown)=>{
  if(!row||typeof row!=='object')return false;
  const r=row as Record<string,unknown>;
  return ['id','sport','marketKey','modelId','predictionCreatedAt','eventStartedAt','result'].every(k=>typeof r[k]==='string')
   &&typeof r.quotedOdds==='number'&&typeof r.predictedProbability==='number'
   &&typeof r.settlementVerified==='boolean'&&typeof r.closingQuoteVerified==='boolean'
   &&(r.settledAt===undefined||typeof r.settledAt==='string')
   &&(r.closingOdds===undefined||typeof r.closingOdds==='number');
 });
 if(!valid)return Response.json({ok:false,error:'INVALID_ROW_SCHEMA'},{status:400});
 const summary=summarizeEdgePerformance(input.rows as SettledEdgePick[]);
 return Response.json({ok:true,sourceAuthenticated:false,verification:'USER_SUPPLIED_FLAGS_NOT_INDEPENDENTLY_AUDITED',summary},
  {headers:{'Cache-Control':'no-store'}});
}
