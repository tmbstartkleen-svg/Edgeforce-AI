import {activationReadiness} from '@/lib/mlActivation';

export const dynamic='force-dynamic';

export async function GET(){
 const unconfigured=activationReadiness({configured:false,healthOk:false,predictionHandshakeOk:false,tournamentOk:false,championsActive:0});
 const unhealthy=activationReadiness({configured:true,healthOk:false,predictionHandshakeOk:false,tournamentOk:false,championsActive:0});
 const ready=activationReadiness({configured:true,healthOk:true,predictionHandshakeOk:true,tournamentOk:false,championsActive:0});
 const awaiting=activationReadiness({configured:true,healthOk:true,predictionHandshakeOk:true,tournamentOk:true,championsActive:0});
 const active=activationReadiness({configured:true,healthOk:true,predictionHandshakeOk:true,tournamentOk:true,championsActive:3});

 const assertions={
  unconfigured:unconfigured.state==='UNCONFIGURED'&&!unconfigured.active,
  unhealthy:unhealthy.state==='UNHEALTHY'&&!unhealthy.active,
  ready:ready.state==='READY'&&!ready.active,
  awaitingEvidence:awaiting.state==='READY_AWAITING_EVIDENCE'&&!awaiting.active,
  active:active.state==='ACTIVE'&&active.active
 };
 const ok=Object.values(assertions).every(Boolean);
 return Response.json({ok,build:'V56',assertions,states:{unconfigured,unhealthy,ready,awaiting,active}},{status:ok?200:500,headers:{'Cache-Control':'no-store'}});
}
