import {db} from './db';

type HealthPayload={
 ok?:boolean;
 serviceVersion?:string;
 algorithms?:Record<string,boolean>;
 modelStore?:string;
};

type CircuitState={
 failures:number;
 openUntil:number;
 lastSuccess:number;
 lastFailure:number;
 lastError:string;
 serviceVersion:string|null;
 algorithms:Record<string,boolean>;
};

const state:CircuitState={
 failures:0,openUntil:0,lastSuccess:0,lastFailure:0,lastError:'',
 serviceVersion:null,algorithms:{}
};

const now=()=>Date.now();
const healthUrl=()=>{
 const explicit=String(process.env.ML_HEALTH_SERVICE_URL||'').trim();
 if(explicit)return explicit;
 for(const raw of [
  process.env.ML_PREDICTION_SERVICE_URL,
  process.env.ML_TRAINING_SERVICE_URL,
  process.env.ML_PROMOTION_SERVICE_URL
 ]){
  const value=String(raw||'').trim();
  if(!value)continue;
  try{
   const url=new URL(value);
   url.pathname='/health';
   url.search='';
   return url.toString();
  }catch{}
 }
 return '';
};

const predictionUrl=()=>String(process.env.ML_PREDICTION_SERVICE_URL||'').trim();
const trainingUrl=()=>String(process.env.ML_TRAINING_SERVICE_URL||'').trim();
const key=()=>String(process.env.ML_PREDICTION_SERVICE_KEY||process.env.ML_TRAINING_SERVICE_KEY||process.env.EXPERT_MODEL_SERVICE_KEY||'').trim();
const failureThreshold=()=>Math.max(1,Number(process.env.ML_SERVICE_FAILURE_THRESHOLD||3));
const cooldownMs=()=>Math.max(30_000,Number(process.env.ML_SERVICE_CIRCUIT_COOLDOWN_MS||300_000));
const healthTimeoutMs=()=>Math.max(1000,Number(process.env.ML_SERVICE_HEALTH_TIMEOUT_MS||5000));

export function mlServiceConfigured(){
 return Boolean(healthUrl()&&predictionUrl()&&trainingUrl());
}

export function mlServiceCircuitStatus(){
 const open=state.openUntil>now();
 return {
  configured:mlServiceConfigured(),
  open,
  failures:state.failures,
  openUntil:state.openUntil?new Date(state.openUntil).toISOString():null,
  lastSuccess:state.lastSuccess?new Date(state.lastSuccess).toISOString():null,
  lastFailure:state.lastFailure?new Date(state.lastFailure).toISOString():null,
  lastError:state.lastError||null,
  serviceVersion:state.serviceVersion,
  algorithms:state.algorithms
 };
}

export function mlServiceCircuitAllows(){
 return state.openUntil<=now();
}

async function persistSnapshot(input:{
 ok:boolean;configured:boolean;latencyMs?:number;predictionReady?:boolean;trainingReady?:boolean;
 error?:string|null;serviceVersion?:string|null;algorithms?:Record<string,boolean>;details?:Record<string,unknown>;
}){
 const sql=db();
 if(!sql)return;
 try{
  await sql`
   insert into ml_service_health_snapshots(
    ok,configured,service_version,latency_ms,algorithms,prediction_ready,training_ready,
    failure_count,circuit_open_until,error_text,details,checked_at
   ) values(
    ${input.ok},${input.configured},${input.serviceVersion||null},${input.latencyMs??null},
    ${sql.json(input.algorithms||{})},${input.predictionReady??false},${input.trainingReady??false},
    ${state.failures},${state.openUntil?new Date(state.openUntil):null},${input.error||null},
    ${sql.json((input.details||{}) as any)},now()
   )
  `;
 }catch{}
}

export async function recordMlServiceSuccess(meta:{serviceVersion?:string|null;algorithms?:Record<string,boolean>}={}){
 state.failures=0;
 state.openUntil=0;
 state.lastSuccess=now();
 state.lastError='';
 if(meta.serviceVersion)state.serviceVersion=meta.serviceVersion;
 if(meta.algorithms)state.algorithms=meta.algorithms;
}

export async function recordMlServiceFailure(error:unknown){
 state.failures++;
 state.lastFailure=now();
 state.lastError=error instanceof Error?error.message:String(error||'ML service failure');
 if(state.failures>=failureThreshold())state.openUntil=now()+cooldownMs();
}

export async function probeMlService(options:{force?:boolean;persist?:boolean}={}){
 const configured=mlServiceConfigured();
 const url=healthUrl();
 if(!configured||!url){
  const result={
   ok:false,configured:false,circuitOpen:false,latencyMs:0,serviceVersion:null,
   algorithms:{} as Record<string,boolean>,predictionReady:false,trainingReady:false,
   error:'ML service endpoints are not fully configured'
  };
  if(options.persist!==false)await persistSnapshot(result);
  return result;
 }
 if(!options.force&&!mlServiceCircuitAllows()){
  const status=mlServiceCircuitStatus();
  return {
   ok:false,configured:true,circuitOpen:true,latencyMs:0,
   serviceVersion:status.serviceVersion,algorithms:status.algorithms,
   predictionReady:false,trainingReady:false,
   error:`ML service circuit open until ${status.openUntil}`
  };
 }

 const started=now();
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),healthTimeoutMs());
 try{
  const res=await fetch(url,{
   headers:{accept:'application/json',...(key()?{authorization:`Bearer ${key()}`}:{})},
   cache:'no-store',signal:controller.signal
  });
  const body=await res.json().catch(()=>({})) as HealthPayload;
  if(!res.ok||body.ok!==true)throw new Error(`ML health HTTP ${res.status}`);
  const algorithms=body.algorithms&&typeof body.algorithms==='object'?body.algorithms:{};
  const latencyMs=now()-started;
  const predictionReady=Boolean(predictionUrl());
  const trainingReady=Boolean(trainingUrl());
  await recordMlServiceSuccess({serviceVersion:body.serviceVersion||null,algorithms});
  const result={
   ok:true,configured:true,circuitOpen:false,latencyMs,
   serviceVersion:body.serviceVersion||null,algorithms,predictionReady,trainingReady,
   modelStore:body.modelStore||null,error:null
  };
  if(options.persist!==false)await persistSnapshot({...result,details:{healthUrl:url}});
  return result;
 }catch(error){
  const latencyMs=now()-started;
  await recordMlServiceFailure(error);
  const result={
   ok:false,configured:true,circuitOpen:!mlServiceCircuitAllows(),latencyMs,
   serviceVersion:state.serviceVersion,algorithms:state.algorithms,
   predictionReady:false,trainingReady:false,
   error:error instanceof Error?error.message:'ML health probe failed'
  };
  if(options.persist!==false)await persistSnapshot(result);
  return result;
 }finally{
  clearTimeout(timer);
 }
}

export async function probeMlPredictionHandshake(){
 const url=predictionUrl();
 if(!url)return {ok:false,error:'ML_PREDICTION_SERVICE_URL is not configured'};
 if(!mlServiceCircuitAllows())return {ok:false,error:'ML service circuit is open'};
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),Math.max(1000,Number(process.env.ML_SERVICE_HANDSHAKE_TIMEOUT_MS||7000)));
 try{
  const res=await fetch(url,{
   method:'POST',
   headers:{'content-type':'application/json',accept:'application/json',...(key()?{authorization:`Bearer ${key()}`}:{})},
   body:JSON.stringify({schemaVersion:'edgeforce-ml-predict-v1',markets:[]}),
   cache:'no-store',signal:controller.signal
  });
  const body=await res.json().catch(()=>({})) as {ok?:boolean;schemaVersion?:string;serviceVersion?:string};
  if(!res.ok||body.ok!==true||body.schemaVersion!=='edgeforce-ml-predict-result-v1'){
   throw new Error(`ML prediction handshake failed HTTP ${res.status}`);
  }
  await recordMlServiceSuccess({serviceVersion:body.serviceVersion||null});
  return {ok:true,serviceVersion:body.serviceVersion||null,schemaVersion:body.schemaVersion};
 }catch(error){
  await recordMlServiceFailure(error);
  return {ok:false,error:error instanceof Error?error.message:'ML prediction handshake failed'};
 }finally{
  clearTimeout(timer);
 }
}

export async function mlServiceHealthHistory(limit=30){
 const sql=db();
 if(!sql)return {ok:true,source:'none' as const,latest:null,rows:[],circuit:mlServiceCircuitStatus()};
 try{
  const rows=await sql`
   select ok,configured,service_version as "serviceVersion",latency_ms as "latencyMs",
    algorithms,prediction_ready as "predictionReady",training_ready as "trainingReady",
    failure_count as "failureCount",circuit_open_until as "circuitOpenUntil",
    error_text as error,details,checked_at as "checkedAt"
   from ml_service_health_snapshots order by checked_at desc limit ${Math.max(1,Math.min(200,limit))}
  `;
  return {ok:true,source:'database' as const,latest:rows[0]||null,rows,circuit:mlServiceCircuitStatus()};
 }catch(error){
  return {ok:false,source:'database' as const,latest:null,rows:[],circuit:mlServiceCircuitStatus(),error:error instanceof Error?error.message:'ML health history failed'};
 }
}
