import {getOpsStatus} from '@/lib/opsStatus';

export async function GET(){
 return Response.json(await getOpsStatus());
}
