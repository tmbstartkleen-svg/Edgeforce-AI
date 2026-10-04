import {championDriftStatus} from '@/lib/mlChampionDrift';

export const dynamic='force-dynamic';

export async function GET(){
 const status=await championDriftStatus();
 return Response.json({...status,build:'V59',schemaVersion:'v59-ml-champion-drift-1'},{headers:{'Cache-Control':'no-store'}});
}
