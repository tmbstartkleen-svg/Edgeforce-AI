import {NextResponse} from 'next/server';
import {
  getLiveVercelGovernorTelemetry,
  persistVercelGovernorSnapshot,
  recentVercelGovernorSnapshots,
  recentVercelGovernorDecisions,
  recentVercelGovernorAlerts,
  syncVercelGovernorAlerts
} from '@/lib/vercelGovernorTelemetry';
import {
  getEdgeforceReleaseBacklog,
  persistEdgeforceReleaseBacklog,
  recentEdgeforceReleaseBacklog
} from '@/lib/edgeforceReleaseBacklog';

export const dynamic='force-dynamic';

export async function GET(){
  try{
    const [live,backlogLive]=await Promise.all([
      getLiveVercelGovernorTelemetry(),
      getEdgeforceReleaseBacklog()
    ]);
    if(!live.configured||!live.telemetry){
      const [history,decisions,alerts,backlogHistory]=await Promise.all([
        recentVercelGovernorSnapshots(24),
        recentVercelGovernorDecisions(36),
        recentVercelGovernorAlerts(24),
        recentEdgeforceReleaseBacklog(24)
      ]);
      return NextResponse.json({
        ok:false,
        configured:false,
        error:live.error,
        backlog:backlogLive.backlog,
        backlogError:backlogLive.error,
        backlogHistory,
        history,
        decisions,
        alerts
      },{status:503});
    }

    const telemetry=live.telemetry;
    const persistence=await persistVercelGovernorSnapshot(telemetry);
    const backlogPersistence=backlogLive.backlog
      ? await persistEdgeforceReleaseBacklog(backlogLive.backlog)
      : {mode:'unavailable',id:null,stored:false};
    const currentAlerts=await syncVercelGovernorAlerts(telemetry);
    const [history,decisions,alerts,backlogHistory]=await Promise.all([
      recentVercelGovernorSnapshots(24),
      recentVercelGovernorDecisions(36),
      recentVercelGovernorAlerts(24),
      recentEdgeforceReleaseBacklog(24)
    ]);
    return NextResponse.json({
      ok:true,
      configured:true,
      telemetry,
      persistence,
      backlog:backlogLive.backlog,
      backlogError:backlogLive.error,
      backlogPersistence,
      backlogHistory,
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
        'x-edgeforce-governor-telemetry':'v144'
      }
    });
  }catch(error){
    const [history,decisions,alerts,backlogHistory]=await Promise.all([
      recentVercelGovernorSnapshots(24),
      recentVercelGovernorDecisions(36),
      recentVercelGovernorAlerts(24),
      recentEdgeforceReleaseBacklog(24)
    ]);
    return NextResponse.json({
      ok:false,
      configured:Boolean(process.env.VERCEL_TOKEN),
      error:error instanceof Error?error.message:'Vercel governor telemetry failed',
      history,
      decisions,
      alerts,
      backlogHistory
    },{status:502});
  }
}
