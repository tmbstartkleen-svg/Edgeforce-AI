import {NextResponse} from 'next/server';
import {
  getLiveVercelGovernorTelemetry,
  persistVercelGovernorSnapshot,
  recentVercelGovernorSnapshots
} from '@/lib/vercelGovernorTelemetry';

export const dynamic='force-dynamic';

export async function GET(){
  try{
    const live=await getLiveVercelGovernorTelemetry();
    if(!live.configured||!live.telemetry){
      return NextResponse.json({
        ok:false,
        configured:false,
        error:live.error,
        history:await recentVercelGovernorSnapshots(24)
      },{status:503});
    }
    const [persistence,history]=await Promise.all([
      persistVercelGovernorSnapshot(live.telemetry),
      recentVercelGovernorSnapshots(24)
    ]);
    return NextResponse.json({
      ok:true,
      configured:true,
      telemetry:live.telemetry,
      persistence,
      history
    },{
      headers:{
        'cache-control':'no-store, max-age=0',
        'x-edgeforce-governor-telemetry':'v140'
      }
    });
  }catch(error){
    return NextResponse.json({
      ok:false,
      configured:Boolean(process.env.VERCEL_TOKEN),
      error:error instanceof Error?error.message:'Vercel governor telemetry failed',
      history:await recentVercelGovernorSnapshots(24)
    },{status:502});
  }
}
