import {evaluateProductionTopology} from '@/lib/productionTopologyWatchdog';
import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 const commit='0123456789abcdef';
 const convergence={
  certified:true,vercelVerified:true,cloudflareVerified:true,commitSha:commit,
  cloudflareUrl:'https://edgeforce-ai.example.workers.dev',
  vercelUrl:'https://edgeforce-ai.vercel.app',
  evidence:{
   primary:{platform:'cloudflare',commitSha:commit,deploymentUrl:'https://edgeforce-ai.example.workers.dev',exactMainCertified:true,hostedSmokePassed:true,platformReady:true},
   standby:{deploymentId:'dpl_fixture',deploymentUrl:'https://edgeforce-ai.vercel.app',commitSha:'fedcba9876543210',state:'READY',manualOnly:true,commitDrift:true}
  }
 };
 const closure={id:1,closed:true,commitSha:commit,blockers:[]};
 const healthy=evaluateProductionTopology({
  currentCommit:commit,convergence,closure,
  standbyHealth:{ok:true,httpStatus:200,version:RELEASE.appVersion,migrationVersion:RELEASE.migrationVersion,deploymentCommit:'fedcba9876543210',attempts:1,error:null}
 });
 const badStandby=evaluateProductionTopology({
  currentCommit:commit,convergence,closure,
  standbyHealth:{ok:false,httpStatus:503,version:null,migrationVersion:null,deploymentCommit:null,attempts:3,error:'HTTP 503'}
 });
 const staleClosure=evaluateProductionTopology({
  currentCommit:commit,convergence,closure:{...closure,commitSha:'aaaaaaaaaaaaaaaa'},
  standbyHealth:{ok:true,httpStatus:200,version:RELEASE.appVersion,migrationVersion:RELEASE.migrationVersion,deploymentCommit:'fedcba9876543210',attempts:1,error:null}
 });
 const assertions={
  healthyReady:healthy.ready===true&&healthy.failoverReady===true,
  driftAllowed:healthy.standby.commitDrift===true&&healthy.ready===true,
  automaticPromotionDisabled:healthy.manualFailover.automaticPromotionAllowed===false&&healthy.manualFailover.requiresHumanApproval===true,
  badStandbyBlocks:badStandby.ready===false&&badStandby.blockers.some((x:string)=>x.includes('standby public health')),
  staleClosureBlocks:staleClosure.ready===false&&staleClosure.blockers.some((x:string)=>x.includes('production closure does not match'))
 };
 return Response.json({ok:Object.values(assertions).every(Boolean),schemaVersion:'v146-topology-watchdog-test-1',assertions,healthy,badStandby,staleClosure});
}
