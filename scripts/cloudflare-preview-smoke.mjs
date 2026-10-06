const base=String(process.env.PREVIEW_URL||'').replace(/\/$/,'');
const expected=process.env.EXPECTED_APP_VERSION||'117.0.0';
const expectedModel=process.env.EXPECTED_MODEL_VERSION||'edgeforce-v117';
if(!/^https:\/\//.test(base))throw new Error('PREVIEW_URL must be https');

async function get(path){
 const res=await fetch(base+path,{redirect:'follow'});
 const text=await res.text();
 let body=null;try{body=JSON.parse(text)}catch{}
 return {res,body,text};
}

let last='';
for(let i=0;i<20;i++){
 try{
  const live=await get('/api/health/live');
  if(live.res.ok&&live.body?.live===true&&live.body?.version===expected){
   const health=await get('/api/health');
   if(!health.res.ok)throw new Error('health endpoint failed');
   if(health.body?.version!==expected)throw new Error(`health version mismatch: ${health.body?.version}; expected ${expected}`);
   if(health.body?.modelVersion!==expectedModel)throw new Error(`model mismatch: ${health.body?.modelVersion}; expected ${expectedModel}`);
   console.log(JSON.stringify({ok:true,preview:base,version:expected,modelVersion:health.body.modelVersion}));
   process.exit(0);
  }
  last=`live status=${live.res.status} body=${live.text.slice(0,240)}`;
 }catch(error){last=String(error)}
 await new Promise(resolve=>setTimeout(resolve,3000));
}
throw new Error('Cloudflare hosted preview did not become healthy: '+last);
