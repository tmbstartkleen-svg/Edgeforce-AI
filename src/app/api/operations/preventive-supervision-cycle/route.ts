import {loadPreventiveSupervisionCycleSummary} from '@/lib/preventiveSupervisionCycle';
export const dynamic='force-dynamic';
export async function GET(){
 try{return Response.json({ok:true,build:'V96',schemaVersion:'v96-supervision-cycle-1',...(await loadPreventiveSupervisionCycleSummary())},{headers:{'Cache-Control':'no-store'}})}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'supervision cycle load failed'},{status:500})}
}
