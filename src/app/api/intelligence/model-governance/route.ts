import {getModelGovernanceStatus} from '@/lib/modelGovernance';

export const dynamic='force-dynamic';

export async function GET(){
 const status=await getModelGovernanceStatus();
 return Response.json(status,{
  status:status.ok?200:503,
  headers:{'Cache-Control':'no-store'}
 });
}
