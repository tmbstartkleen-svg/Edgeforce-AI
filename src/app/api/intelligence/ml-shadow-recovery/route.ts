import {shadowRecoveryStatus} from '@/lib/mlShadowRecovery';

export const dynamic='force-dynamic';

export async function GET(){
 const status=await shadowRecoveryStatus();
 return Response.json({...status,build:'V61',schemaVersion:'v61-shadow-league-1'},{headers:{'Cache-Control':'no-store'}});
}
