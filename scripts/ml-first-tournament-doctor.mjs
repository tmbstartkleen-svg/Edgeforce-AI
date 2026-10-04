const base=String(process.env.EDGEFORCE_BASE_URL||'').replace(/\/$/,'');
const secret=String(process.env.ML_ACTIVATION_SECRET||'');

function fail(message,details){
 console.error(JSON.stringify({ok:false,message,details},null,2));
 process.exit(1);
}
if(!base)fail('EDGEFORCE_BASE_URL is required');
if(!secret)fail('ML_ACTIVATION_SECRET is required');

const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),Number(process.env.ML_FIRST_TOURNAMENT_TIMEOUT_MS||1200000));
let res,body;
try{
 res=await fetch(base+'/api/ml/first-tournament',{
  method:'POST',
  headers:{authorization:`Bearer ${secret}`,'content-type':'application/json',accept:'application/json'},
  body:'{}',
  signal:controller.signal
 });
 const text=await res.text();
 try{body=JSON.parse(text)}catch{body={raw:text}}
}finally{clearTimeout(timer)}

const grade=body?.evidence?.grade;
const accepted=['VERIFIED','LIMITED_COVERAGE','AWAITING_CHAMPION','NO_EVIDENCE'];
if(![200,202].includes(res.status)||body?.ok!==true||!accepted.includes(grade)){
 fail('First champion tournament did not reach a safe terminal state',{status:res.status,grade,body});
}
if(grade==='ARTIFACT_MISMATCH'||Number(body?.summary?.artifactsMissing||0)>0){
 fail('Promoted champion artifact verification failed',{grade,summary:body?.summary,artifacts:body?.artifacts});
}

console.log(JSON.stringify({
 ok:true,
 grade,
 launchReady:Boolean(body?.evidence?.launchReady),
 reason:body?.evidence?.reason||null,
 activationState:body?.activation?.state||null,
 serviceVersion:body?.artifacts?.serviceVersion||null,
 tournamentRunId:body?.tournamentRunId||null,
 candidates:Number(body?.summary?.candidates||0),
 groups:Number(body?.summary?.groups||0),
 champions:Number(body?.summary?.champions||0),
 sports:Number(body?.summary?.sports||0),
 championChanges:Number(body?.summary?.championChanges||0),
 artifactsVerified:Number(body?.summary?.artifactsVerified||0),
 artifactsMissing:Number(body?.summary?.artifactsMissing||0)
},null,2));
