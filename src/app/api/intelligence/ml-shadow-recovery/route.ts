import {shadowRecoveryStatus} from '@/lib/mlShadowRecovery';

export const dynamic='force-dynamic';

export async function GET(){
 const status=await shadowRecoveryStatus();
 return Response.json({...status,build:'V60',schemaVersion:'v60-shadow-recovery-1'},{headers:{'Cache-Control':'no-store'}});
}
