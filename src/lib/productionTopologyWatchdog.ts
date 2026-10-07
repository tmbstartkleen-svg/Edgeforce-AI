import {RELEASE} from './releaseManifest';
import {latestPlatformConvergence} from './releasePlatformConvergence';
import {latestFinalProductionClosure} from './finalProductionClosure';

export type TopologyWatchdogState='READY'|'DEGRADED'|'NOT_READY';

export type StandbyHealth={
 ok:boolean;
 httpStatus:number|null;
 version:string|null;
 migrationVersion:number|null;
 deploymentCommit:string|null;
 attempts:number;
 error:string|null;
};

export type ProductionTopologyWatchdogInput={
 currentCommit:string|null;
 convergence:any;
 closure:any;
 standbyHealth:StandbyHealth;
 checkedAt?:string;
};

export function evaluateProductionTopology(input:ProductionTopologyWatchdogInput){
 const convergence=input.convergence||null;
 const closure=input.closure||null;
 const evidence=convergence?.evidence&&typeof convergence.evidence==='object'?convergence.evidence:{};
 const primary=evidence?.primary||{};
 const standby=evidence?.standby||{};
 const currentCommit=String(input.currentCommit||'');
 const blockers:string[]=[];
 const warnings:string[]=[];

 const primaryCurrent=Boolean(
  currentCommit
  &&convergence?.certified===true
  &&closure?.closed===true
  &&String(convergence?.commitSha||'')===currentCommit
  &&String(closure?.commitSha||'')===currentCommit
  &&String(primary?.commitSha||'')===currentCommit
  &&primary?.platform==='cloudflare'
  &&primary?.exactMainCertified===true
  &&primary?.hostedSmokePassed===true
  &&primary?.platformReady===true
 );

 const standbyConfigured=Boolean(
  convergence?.vercelVerified===true
  &&standby?.manualOnly===true
  &&String(standby?.state||'').toUpperCase()==='READY'
  &&standby?.deploymentId
  &&standby?.deploymentUrl
 );

 const standbyLive=Boolean(
  input.standbyHealth.ok
  &&input.standbyHealth.httpStatus===200
  &&input.standbyHealth.version===RELEASE.appVersion
  &&Number(input.standbyHealth.migrationVersion)===RELEASE.migrationVersion
 );

 if(!currentCommit)blockers.push('current Cloudflare deployment commit is unavailable');
 if(!convergence?.certified)blockers.push('latest primary/standby topology evidence is not certified');
 if(!closure?.closed)blockers.push('latest production closure is not closed');
 if(currentCommit&&String(convergence?.commitSha||'')!==currentCommit)blockers.push('topology evidence does not match current Cloudflare commit');
 if(currentCommit&&String(closure?.commitSha||'')!==currentCommit)blockers.push('production closure does not match current Cloudflare commit');
 if(!standbyConfigured)blockers.push('Vercel standby is not recorded as READY manual disaster recovery');
 if(!standbyLive)blockers.push('Vercel standby public health is not release-compatible');
 if(standby?.commitDrift===true)warnings.push('Vercel standby commit drift is expected until failover or standby refresh');
 if(input.standbyHealth.attempts>1)warnings.push(`Vercel standby health required ${input.standbyHealth.attempts} attempts`);

 const failoverReady=primaryCurrent&&standbyConfigured&&standbyLive;
 const ready=blockers.length===0&&failoverReady;
 const state:TopologyWatchdogState=ready?'READY':primaryCurrent?'DEGRADED':'NOT_READY';

 return {
  ok:true,
  schemaVersion:'v146-topology-watchdog-1',
  state,
  ready,
  primaryCurrent,
  standbyConfigured,
  standbyLive,
  failoverReady,
  currentCommit:currentCommit||null,
  primary:{
   platform:'cloudflare',
   commitSha:primary?.commitSha||convergence?.commitSha||null,
   deploymentUrl:primary?.deploymentUrl||convergence?.cloudflareUrl||null,
   exactMainCertified:Boolean(primary?.exactMainCertified),
   hostedSmokePassed:Boolean(primary?.hostedSmokePassed),
   platformReady:Boolean(primary?.platformReady)
  },
  standby:{
   platform:'vercel',
   deploymentId:standby?.deploymentId||null,
   deploymentUrl:standby?.deploymentUrl||convergence?.vercelUrl||null,
   commitSha:standby?.commitSha||null,
   state:standby?.state||null,
   manualOnly:Boolean(standby?.manualOnly),
   commitDrift:Boolean(standby?.commitDrift),
   liveHealth:input.standbyHealth
  },
  closure:{
   id:closure?.id||null,
   commitSha:closure?.commitSha||null,
   closed:Boolean(closure?.closed),
   blockers:Array.isArray(closure?.blockers)?closure.blockers:[]
  },
  manualFailover:{
   ready:failoverReady,
   automaticPromotionAllowed:false,
   requiresHumanApproval:true,
   targetDeploymentId:standby?.deploymentId||null,
   targetUrl:standby?.deploymentUrl||convergence?.vercelUrl||null,
   standbyCommitSha:standby?.commitSha||null,
   primaryCommitSha:currentCommit||null,
   policy:'verify-current-standby-before-any-manual-promotion'
  },
  blockers,
  warnings,
  checkedAt:input.checkedAt||new Date().toISOString()
 };
}

async function probeStandbyHealth(url:string):Promise<StandbyHealth>{
 let lastError='standby health probe failed';
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const response=await fetch(url,{cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(8000),headers:{'user-agent':'edgeforce-topology-watchdog/146'}});
   const text=await response.text();
   let body:any={};
   try{body=JSON.parse(text)}catch{}
   if(response.status>=500&&attempt<3){
    await new Promise(resolve=>setTimeout(resolve,250*attempt));
    continue;
   }
   return {
    ok:response.ok&&body?.ok===true,
    httpStatus:response.status,
    version:body?.version?String(body.version):null,
    migrationVersion:Number.isFinite(Number(body?.migrationVersion))?Number(body.migrationVersion):null,
    deploymentCommit:body?.deploymentCommit?String(body.deploymentCommit):null,
    attempts:attempt,
    error:response.ok&&body?.ok===true?null:(body?.error?String(body.error):`HTTP ${response.status}`)
   };
  }catch(error){
   lastError=error instanceof Error?error.message:'standby health probe failed';
   if(attempt<3){
    await new Promise(resolve=>setTimeout(resolve,250*attempt));
    continue;
   }
   return {ok:false,httpStatus:null,version:null,migrationVersion:null,deploymentCommit:null,attempts:attempt,error:lastError};
  }
 }
 return {ok:false,httpStatus:null,version:null,migrationVersion:null,deploymentCommit:null,attempts:3,error:lastError};
}

export async function getProductionTopologyStatus(){
 const [convergence,closure]=await Promise.all([
  latestPlatformConvergence(),
  latestFinalProductionClosure()
 ]);
 const standbyUrl=String(
  (convergence as any)?.evidence?.standby?.deploymentUrl
  ||(convergence as any)?.vercelUrl
  ||process.env.VERCEL_STANDBY_URL
  ||'https://edgeforce-ai.vercel.app'
 ).replace(/\/$/,'');
 const standbyHealth=await probeStandbyHealth(`${standbyUrl}/api/health`);
 const currentCommit=process.env.DEPLOYMENT_COMMIT||process.env.VERCEL_GIT_COMMIT_SHA||null;
 return evaluateProductionTopology({currentCommit,convergence,closure,standbyHealth});
}
