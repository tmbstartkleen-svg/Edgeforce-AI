import {db} from './db';
import {RELEASE} from './releaseManifest';
import {mlActivationStatus} from './mlActivation';
import {probeMlService} from './mlServiceHealth';

export async function recordMlDeploymentAttestation(input:{deploymentId?:string|null}={}){
 const health=await probeMlService({force:true,persist:true});
 const activation=await mlActivationStatus();
 const deployment=(health as any).deployment||{};
 const state=activation.readiness?.state||'UNHEALTHY';
 const accepted=state==='ACTIVE'||state==='READY_AWAITING_EVIDENCE';
 const latestRun=activation.tournament?.latestRun as any;
 const championsActive=Number(activation.tournament?.summary?.champions||0);

 const payload={
  ok:accepted&&health.ok,
  build:'V60',
  schemaVersion:'v60-ml-deployment-attestation-1',
  modelVersion:RELEASE.modelVersion,
  deploymentStatus:state,
  healthOk:Boolean(health.ok),
  predictionHandshakeOk:Boolean(activation.latestActivation?.predictionHandshakeOk),
  activationState:state,
  tournamentStatus:latestRun?.status||null,
  championsActive,
  serviceVersion:health.serviceVersion||null,
  provider:deployment.platform||'render',
  serviceId:deployment.serviceId||null,
  serviceName:deployment.serviceName||null,
  serviceUrl:deployment.externalUrl||null,
  gitCommit:deployment.gitCommit||null,
  gitBranch:deployment.gitBranch||null,
  deploymentId:input.deploymentId||null,
  algorithms:health.algorithms||{},
  details:{
   latencyMs:health.latencyMs,
   cpuCount:deployment.cpuCount||null,
   instanceId:deployment.instanceId||null,
   repoSlug:deployment.repoSlug||null,
   activationReason:activation.readiness?.reason||null,
   tournamentRunId:latestRun?.id||null
  },
  error:accepted&&health.ok?null:(health.error||activation.latestActivation?.error||activation.readiness?.reason||'ML deployment not activation-ready')
 };

 const sql=db();
 if(sql){
  try{
   await sql`
    insert into ml_service_deployment_attestations(
     model_version,service_version,provider,service_id,service_name,service_url,
     git_commit,git_branch,deployment_id,deployment_status,health_ok,prediction_handshake_ok,
     activation_state,tournament_status,champions_active,algorithms,details,error_text,created_at
    ) values(
     ${payload.modelVersion},${payload.serviceVersion},${payload.provider},${payload.serviceId},
     ${payload.serviceName},${payload.serviceUrl},${payload.gitCommit},${payload.gitBranch},
     ${payload.deploymentId},${payload.deploymentStatus},${payload.healthOk},
     ${payload.predictionHandshakeOk},${payload.activationState},${payload.tournamentStatus},
     ${payload.championsActive},${sql.json(payload.algorithms)},${sql.json(payload.details as any)},
     ${payload.error},now()
    )
   `;
  }catch{}
 }
 return payload;
}

export async function mlDeploymentAttestationStatus(limit=20){
 const sql=db();
 if(!sql)return {ok:true,source:'none' as const,latest:null,rows:[]};
 try{
  const rows=await sql`
   select id,model_version as "modelVersion",service_version as "serviceVersion",provider,
    service_id as "serviceId",service_name as "serviceName",service_url as "serviceUrl",
    git_commit as "gitCommit",git_branch as "gitBranch",deployment_id as "deploymentId",
    deployment_status as "deploymentStatus",health_ok as "healthOk",
    prediction_handshake_ok as "predictionHandshakeOk",activation_state as "activationState",
    tournament_status as "tournamentStatus",champions_active as "championsActive",
    algorithms,details,error_text as error,created_at as "createdAt"
   from ml_service_deployment_attestations
   order by created_at desc
   limit ${Math.max(1,Math.min(100,limit))}
  `;
  return {ok:true,source:'database' as const,latest:rows[0]||null,rows};
 }catch(error){
  return {ok:false,source:'database' as const,latest:null,rows:[],error:error instanceof Error?error.message:'ML deployment attestation status failed'};
 }
}
