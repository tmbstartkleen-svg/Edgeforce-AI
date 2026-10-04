const base=String(process.env.ML_SERVICE_BASE_URL||'').replace(/\/$/,'');
const key=String(process.env.ML_SERVICE_KEY||'');
const expectedVersion=String(process.env.EXPECTED_ML_SERVICE_VERSION||'edgeforce-ml-service-v57');
const expectedCommit=String(process.env.EXPECTED_ML_COMMIT||'').trim();

function fail(message,details){
 console.error(JSON.stringify({ok:false,message,details},null,2));
 process.exit(1);
}
if(!base)fail('ML_SERVICE_BASE_URL is required');

async function jsonFetch(path,init={}){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),Number(process.env.ML_SERVICE_DOCTOR_TIMEOUT_MS||15000));
 try{
  const res=await fetch(base+path,{
   ...init,
   headers:{
    accept:'application/json',
    ...(init.body?{'content-type':'application/json'}:{}),
    ...(key?{authorization:`Bearer ${key}`}:{}),
    ...(init.headers||{})
   },
   signal:controller.signal
  });
  const text=await res.text();
  let body={};
  try{body=JSON.parse(text)}catch{}
  return {res,body,text};
 }finally{clearTimeout(timer)}
}

const health=await jsonFetch('/health');
if(!health.res.ok||health.body?.ok!==true)fail('ML health check failed',{status:health.res.status,body:health.body});
if(health.body?.serviceVersion!==expectedVersion)fail('ML service version mismatch',{expectedVersion,actual:health.body?.serviceVersion});
const commit=String(health.body?.deployment?.gitCommit||'');
if(expectedCommit&&!commit)fail('ML service did not expose a Render git commit',{expectedCommit,deployment:health.body?.deployment||null});
if(expectedCommit&&commit&&!commit.startsWith(expectedCommit)&&!expectedCommit.startsWith(commit)){
 fail('ML service commit mismatch',{expectedCommit,actual:commit});
}
const algorithms=health.body?.algorithms||{};
for(const required of ['logistic_l2','random_forest','hist_gradient_boosting']){
 if(algorithms[required]!==true)fail('Required baseline ML algorithm unavailable',{required,algorithms});
}

const predict=await jsonFetch('/predict',{
 method:'POST',
 body:JSON.stringify({schemaVersion:'edgeforce-ml-predict-v1',markets:[]})
});
if(!predict.res.ok||predict.body?.ok!==true||predict.body?.schemaVersion!=='edgeforce-ml-predict-result-v1'){
 fail('ML prediction handshake failed',{status:predict.res.status,body:predict.body});
}

console.log(JSON.stringify({
 ok:true,
 serviceVersion:health.body.serviceVersion,
 deployment:health.body.deployment||null,
 algorithms,
 predictionSchema:predict.body.schemaVersion,
 warnings:predict.body.warnings||[]
},null,2));
