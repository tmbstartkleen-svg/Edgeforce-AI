import {getLearningDashboard} from '@/lib/automatedLearning';

export const dynamic='force-dynamic';

export async function GET(){
  try{return Response.json(await getLearningDashboard(),{headers:{'Cache-Control':'no-store'}})}
  catch(error){
    return Response.json({configured:true,latestRun:null,bands:[],rankings:[],error:error instanceof Error?error.message:'Learning dashboard unavailable'},{headers:{'Cache-Control':'no-store'}});
  }
}
