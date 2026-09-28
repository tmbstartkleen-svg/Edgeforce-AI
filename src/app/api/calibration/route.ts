import {summarizeCalibration} from '@/lib/calibration';
export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const points=Array.isArray(body?.points)?body.points:[];
 return Response.json(summarizeCalibration(points));
}
