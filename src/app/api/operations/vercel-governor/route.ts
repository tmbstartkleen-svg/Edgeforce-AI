import {NextResponse} from 'next/server';
import {
  getLiveVercelGovernorTelemetry,
  persistVercelGovernorSnapshot,
  recentVercelGovernorSnapshots,
  recentVercelGovernorDecisions,
  recentVercelGovernorAlerts,
  syncVercelGovernorAlerts
} from '@/lib/vercelGovernorTelemetry';

export const dynamic='force-dynamic';

export async function GET(){
  try{
    const live=await getLiveVercelGovernorTelemetry();
    if(!live.configured||!live.telemetry){
      const [history,decisions,alerts]=await Promise.all([
        recentVercelGovernorSnapshots(24),
        recentVercelGovernorDecisions(36),
        recentVercelGovernorAlerts(24)
      ]);
      return NextResponse.json({
        ok:false,
        configured:false,
        error:live.error,
        history,
        decisions,
        alerts
      },{status:503});
    }

    const persistence=await persistVercelGovernorSnapshot(live.telemetry);
    const currentAlerts=await syncVercelGovernorAlerts(live.telemetry);
    const [history,decisions,alerts]=await Promise.all([
      recentVercelGovernorSnapshots(24),
      recentVercelGovernorDecisions(36),
      recentVercelGovernorAlerts(24)
    ]);
    const telemetry=live.telemetry;
    return NextResponse.json({
      ok:true,
      configured:true,
      telemetry,
      persistence,
      currentAlerts,
      history,
      decisions,
      alerts,
      manualControl:{
        workflow:'team-vercel-manual-release.yml',
        url:'https://github.com/tmbstartkleen-svg/Edgeforce-AI/actions/workflows/team-vercel-manual-release.yml',
        publicBrowserReadOnly:true,
        normalAvailable:telemetry.usage<telemetry.softCap,
        emergencyAvailable:telemetry.usage>=telemetry.softCap&&telemetry.usage<telemetry.hardCap,
        hardBlocked:telemetry.usage>=telemetry.hardCap,
        normalCap:telemetry.softCap,
        hardCap:telemetry.hardCap,
        justificationRequired:true
      }
    },{
      headers:{
        'cache-control':'no-store, max-age=0',
        'x-edgeforce-governor-telemetry':'v142'
      }
    });
  }catch(error){
    const [history,decisions,alerts]=await Promise.all([
      recentVercelGovernorSnapshots(24),
      recentVercelGovernorDecisions(36),
      recentVercelGovernorAlerts(24)
    ]);
    return NextResponse.json({
      ok:false,
      configured:Boolean(process.env.VERCEL_TOKEN),
      error:error instanceof Error?error.message:'Vercel governor telemetry failed',
      history,
      decisions,
      alerts
    },{status:502});
  }
}
