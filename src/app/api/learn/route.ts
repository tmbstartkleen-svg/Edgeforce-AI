import {summarizeCalibration} from '@/lib/calibration';
export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const calibration=summarizeCalibration(Array.isArray(body?.points)?body.points:[]);
 const adjustment=calibration.sampleSize<50?0:Math.max(-.03,Math.min(.03,(.5-calibration.brierScore)*.02-calibration.calibrationError*.1));
 return Response.json({calibration,suggestedProbabilityAdjustment:adjustment,modelVersion:process.env.MODEL_VERSION||'edgeforce-v6'});
}
