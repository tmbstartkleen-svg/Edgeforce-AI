import {mlActivationStatus} from '@/lib/mlActivation';

export const dynamic='force-dynamic';

export async function GET(){
 const status=await mlActivationStatus();
 return Response.json(status,{headers:{'Cache-Control':'no-store'}});
}
