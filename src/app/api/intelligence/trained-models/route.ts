import {trainedModelStatus} from '@/lib/trainedSportModels';

export const dynamic='force-dynamic';

export async function GET(){
 const status=await trainedModelStatus();
 return Response.json({
  ...status,
  build:'V54',
  schemaVersion:'v54-trained-sport-ml-1'
 },{headers:{'Cache-Control':'no-store'}});
}
