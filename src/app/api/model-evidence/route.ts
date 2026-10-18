import {evaluateModelEvidence,type ProbabilityEvidence} from '@/lib/modelEvidenceGate';
export const dynamic='force-dynamic';

/** Research gate only. Caller-supplied evidence has not been independently audited. */
export async function POST(request:Request){
  let body:unknown;
  try{body=await request.json();}catch{return Response.json({ok:false,error:'INVALID_JSON'},{status:400});}
  if(!body||typeof body!=='object')return Response.json({ok:false,error:'INVALID_BODY'},{status:400});
  const input=body as Record<string,unknown>;
  if(typeof input.americanOdds!=='number'||!input.evidence||typeof input.evidence!=='object')
    return Response.json({ok:false,error:'MISSING_EVIDENCE_OR_ODDS'},{status:400});
  const evidence=input.evidence as Partial<ProbabilityEvidence>;
  if(typeof evidence.probability!=='number'||typeof evidence.modelId!=='string'||typeof evidence.modelVersion!=='string'||
    typeof evidence.generatedAt!=='string'||typeof evidence.trainedThrough!=='string'||
    typeof evidence.independentOfTargetBook!=='boolean'||typeof evidence.outOfSampleSettledCount!=='number'||
    !Array.isArray(evidence.features)||!evidence.features.every(f=>f&&typeof f.name==='string'&&typeof f.source==='string'&&typeof f.observedAt==='string')||
    !(evidence.outOfSampleBrierScore===null||typeof evidence.outOfSampleBrierScore==='number'))
    return Response.json({ok:false,error:'INVALID_EVIDENCE_SCHEMA'},{status:400});
  try{
    const result=evaluateModelEvidence(input.americanOdds,evidence as ProbabilityEvidence,new Date().toISOString());
    return Response.json({ok:true,claimVerified:false,sourceVerified:false, ...result},{
      headers:{'Cache-Control':'no-store,max-age=0'}
    });
  }catch{return Response.json({ok:false,error:'EVALUATION_FAILED'},{status:400});}
}
