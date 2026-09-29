import {releaseReadiness} from '@/lib/release';

export async function GET(){
 const readiness=await releaseReadiness();
 return Response.json(readiness,{status:readiness.ready?200:503});
}
