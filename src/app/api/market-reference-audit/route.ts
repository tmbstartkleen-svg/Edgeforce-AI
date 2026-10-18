import {auditMarketReferences,type MarketQuoteEvidence} from '@/lib/marketReferenceAudit';
export const dynamic='force-dynamic';
function isQuote(x:unknown):x is MarketQuoteEvidence{
 if(!x||typeof x!=='object')return false;
 const q=x as Record<string,unknown>;
 return ['eventKey','marketKey','outcomeKey','sportsbook','upstreamId','observedAt'].every(k=>typeof q[k]==='string')&&typeof q.americanOdds==='number';
}
export async function POST(req:Request){
 let payload:unknown;
 try{payload=await req.json();}catch{return Response.json({ok:false,error:'INVALID_JSON'},{status:400});}
 if(!payload||typeof payload!=='object')return Response.json({ok:false,error:'INVALID_BODY'},{status:400});
 const input=payload as Record<string,unknown>;
 if(!isQuote(input.target)||!Array.isArray(input.references)||input.references.length>1000||
 !input.references.every(isQuote)||typeof input.modelProbability!=='number')
 return Response.json({ok:false,error:'INVALID_QUOTE_SCHEMA'},{status:400});
 try{
 const audit=auditMarketReferences(input.target,input.references,input.modelProbability,new Date().toISOString());
 return Response.json({ok:true,sourceFeedsAuthenticated:false,modelVerified:false,alertsAllowed:false,...audit},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({ok:false,error:'INVALID_AUDIT_INPUT'},{status:400});}
}
