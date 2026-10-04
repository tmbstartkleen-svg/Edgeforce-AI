const base=String(process.env.EDGEFORCE_BASE_URL||'').replace(/\/$/,'');
const secret=String(process.env.ML_ACTIVATION_SECRET||'');
const runTournament=String(process.env.ML_ACTIVATION_RUN_TOURNAMENT||'true').toLowerCase()!=='false';

function fail(message,details){
 console.error(JSON.stringify({ok:false,message,details},null,2));
 process.exit(1);
}
if(!base)fail('EDGEFORCE_BASE_URL is required');
if(!secret)fail('ML_ACTIVATION_SECRET is required');

const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),Number(process.env.ML_ACTIVATION_DOCTOR_TIMEOUT_MS||960000));
let res,body;
try{
 res=await fetch(base+'/api/ml/activate',{
  method:'POST',
  headers:{authorization:`Bearer ${secret}`,'content-type':'application/json',accept:'application/json'},
  body:JSON.stringify({runTournament}),
  signal:controller.signal
 });
 const text=await res.text();
 try{body=JSON.parse(text)}catch{body={raw:text}}
}finally{clearTimeout(timer)}

const state=body?.readiness?.state;
const accepted=['ACTIVE','READY_AWAITING_EVIDENCE'];
if(![200,202].includes(res.status)||body?.ok!==true||!accepted.includes(state)){
 fail('EdgeForce ML activation did not reach an accepted state',{status:res.status,state,body});
}
console.log(JSON.stringify({
 ok:true,
 state,
 active:Boolean(body?.readiness?.active),
 reason:body?.readiness?.reason||null,
 serviceVersion:body?.health?.serviceVersion||null,
 tournamentMode:body?.tournament?.mode||null,
 candidates:Number(body?.tournament?.candidates||0),
 promoted:Number(body?.tournament?.promoted||0),
 championsActive:Number(body?.championsActive||0),
 algorithmsAvailable:body?.algorithmsAvailable||{}
},null,2));
