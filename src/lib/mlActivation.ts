import {db} from './db';
import {RELEASE} from './releaseManifest';
import {externalMlTournamentStatus,runExternalMlTournament} from './externalMlTournament';
import {mlServiceHealthHistory,probeMlPredictionHandshake,probeMlService} from './mlServiceHealth';

export type MlActivationState='UNCONFIGURED'|'UNHEALTHY'|'READY'|'READY_AWAITING_EVIDENCE'|'ACTIVE';

export function activationReadiness(input:{
 configured:boolean;
 healthOk:boolean;
 predictionHandshakeOk:boolean;
 tournamentOk:boolean;
 championsActive:number;
}):{state:MlActivationState;active:boolean;reason:string}{
 if(!input.configured)return {state:'UNCONFIGURED',active:false,reason:'ML service endpoints are not configured'};
 if(!input.healthOk)return {state:'UNHEALTHY',active:false,reason:'ML service health check is failing'};
 if(!input.predictionHandshakeOk)return {state:'UNHEALTHY',active:false,reason:'ML prediction contract handshake failed'};
 if(!input.tournamentOk)return {state:'READY',active:false,reason:'Service is healthy but tournament validation has not completed successfully'};
 if(input.championsActive<1)return {state:'READY_AWAITING_EVIDENCE',active:false,reason:'Service is healthy but no external ML champion has cleared promotion gates yet'};
 return {state:'ACTIVE',active:true,reason:`${input.championsActive} external ML champion(s) are active`};
}

async function persistActivation(input:{
 status:string;serviceVersion?:string|null;healthOk:boolean;predictionHandshakeOk:boolean;
 tournamentOk:boolean;tournamentRunId?:number|null;candidatesEvaluated?:number;championsPromoted?:number;
 championsActive?:number;algorithmsAvailable?:Record<string,boolean>;checks?:Record<string,unknown>;error?:string|null;
}){
 const sql=db();
 if(!sql)return null;
 try{
  const [row]=await sql`
   insert into ml_service_activation_runs(
    model_version,status,service_version,health_ok,prediction_handshake_ok,tournament_ok,
    tournament_run_id,candidates_evaluated,champions_promoted,champions_active,
    algorithms_available,checks,error_text,started_at,completed_at
   ) values(
    ${RELEASE.modelVersion},${input.status},${input.serviceVersion||null},
    ${input.healthOk},${input.predictionHandshakeOk},${input.tournamentOk},
    ${input.tournamentRunId??null},${input.candidatesEvaluated??0},${input.championsPromoted??0},
    ${input.championsActive??0},${sql.json(input.algorithmsAvailable||{})},
    ${sql.json((input.checks||{}) as any)},${input.error||null},now(),now()
   ) returning id
  `;
  return Number(row?.id||0)||null;
 }catch{
  return null;
 }
}

export async function activateMlService(options:{runTournament?:boolean}={}){
 const health=await probeMlService({force:true});
 const handshake=health.ok?await probeMlPredictionHandshake():{ok:false,error:'health check failed'};
 let tournament:any={ok:false,mode:'skipped',candidates:0,promoted:0};
 if(health.ok&&handshake.ok&&options.runTournament!==false){
  try{
   tournament=await runExternalMlTournament();
  }catch(error){
   tournament={ok:false,mode:'failed',error:error instanceof Error?error.message:'external ML tournament failed',candidates:0,promoted:0};
  }
 }
 const status=await externalMlTournamentStatus();
 const championsActive=Number(status.summary?.champions||0);
 const tournamentOk=Boolean(tournament.ok||(!options.runTournament&&status.latestRun?.status==='completed'));
 const readiness=activationReadiness({
  configured:health.configured,
  healthOk:health.ok,
  predictionHandshakeOk:Boolean(handshake.ok),
  tournamentOk,
  championsActive
 });
 const activationId=await persistActivation({
  status:readiness.state,serviceVersion:health.serviceVersion,
  healthOk:health.ok,predictionHandshakeOk:Boolean(handshake.ok),tournamentOk,
  tournamentRunId:Number(tournament.runId||0)||null,
  candidatesEvaluated:Number(tournament.candidates||0),championsPromoted:Number(tournament.promoted||0),
  championsActive,algorithmsAvailable:health.algorithms,
  checks:{health,handshake,tournamentMode:tournament.mode||null,readiness},
  error:readiness.active?null:(tournament.error||health.error||(handshake as any).error||null)
 });
 return {
  ok:health.ok&&Boolean(handshake.ok),
  build:'V57',schemaVersion:'v57-ml-activation-1',
  activationId,readiness,health,handshake,tournament,
  champions:status.champions||[],championsActive,
  algorithmsAvailable:health.algorithms||{}
 };
}

export async function mlActivationStatus(){
 const [healthHistory,tournament]=await Promise.all([
  mlServiceHealthHistory(20),
  externalMlTournamentStatus()
 ]);
 const latestHealth=healthHistory.latest as any;
 const configured=Boolean(latestHealth?.configured??healthHistory.circuit?.configured);
 const healthOk=Boolean(latestHealth?.ok);
 const predictionHandshakeOk=Boolean(latestHealth?.predictionReady)&&!Boolean(healthHistory.circuit?.open);
 const tournamentOk=Boolean(tournament.latestRun?.status==='completed');
 const championsActive=Number(tournament.summary?.champions||0);
 let readiness=activationReadiness({configured,healthOk,predictionHandshakeOk,tournamentOk,championsActive});

 const sql=db();
 let latestActivation:any=null;
 if(sql){
  try{
   const rows=await sql`
    select id,model_version as "modelVersion",status,service_version as "serviceVersion",
     health_ok as "healthOk",prediction_handshake_ok as "predictionHandshakeOk",
     tournament_ok as "tournamentOk",tournament_run_id as "tournamentRunId",
     candidates_evaluated as "candidatesEvaluated",champions_promoted as "championsPromoted",
     champions_active as "championsActive",algorithms_available as "algorithmsAvailable",
     checks,error_text as error,started_at as "startedAt",completed_at as "completedAt"
    from ml_service_activation_runs order by started_at desc limit 1
   `;
   latestActivation=rows[0]||null;
   if(latestActivation){
    readiness=activationReadiness({
     configured,
     healthOk:Boolean(latestActivation.healthOk),
     predictionHandshakeOk:Boolean(latestActivation.predictionHandshakeOk),
     tournamentOk:Boolean(latestActivation.tournamentOk),
     championsActive:Number(latestActivation.championsActive||championsActive)
    });
   }
  }catch{}
 }

 return {
  ok:true,build:'V57',schemaVersion:'v57-ml-activation-1',
  readiness,latestActivation,health:healthHistory,tournament,
  deployment:{
   renderBlueprint:true,
   persistentModelStoreRequired:true,
   expectedHealthPath:'/health',
   expectedPredictionPath:'/predict',
   expectedTrainingPath:'/train',
   expectedPromotionPath:'/promote'
  }
 };
}
