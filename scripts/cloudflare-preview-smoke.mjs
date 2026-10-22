const base=String(process.env.PREVIEW_URL||'').replace(/\/$/,'');
const expected=process.env.EXPECTED_APP_VERSION||'119.0.0';
const expectedModel=process.env.EXPECTED_MODEL_VERSION||'edgeforce-v119';
if(!/^https:\/\//.test(base))throw new Error('PREVIEW_URL must be https');

async function get(path){
 const res=await fetch(base+path,{redirect:'follow'});
 const text=await res.text();
 let body=null;try{body=JSON.parse(text)}catch{}
 return {res,body,text};
}

let last='';
let platform404Count=0;
for(let i=0;i<20;i++){
 try{
  const live=await get('/api/health/live');
  if(live.res.ok&&live.body?.live===true&&live.body?.version===expected){
   const health=await get('/api/health');
   if(!health.res.ok)throw new Error('health endpoint failed');
   if(health.body?.version!==expected)throw new Error(`health version mismatch: ${health.body?.version}; expected ${expected}`);
   if(health.body?.modelVersion!==expectedModel)throw new Error(`model mismatch: ${health.body?.modelVersion}; expected ${expectedModel}`);
   const coverage=await get('/coverage');
   if(!coverage.res.ok||!coverage.text.includes('Every gap visible')||!coverage.text.includes('Fair-price and theoretical arbitrage lab'))throw new Error(`coverage dashboard inaccessible: HTTP ${coverage.res.status}`);
   const protectedOdds=await get('/api/operations/d1-pilot/coverage');
   if(protectedOdds.res.status!==401)throw new Error(`coverage odds auth gate expected 401, received ${protectedOdds.res.status}`);
   console.log(JSON.stringify({ok:true,preview:base,version:expected,modelVersion:health.body.modelVersion,coveragePage:true,oddsAuthGate:true}));
   process.exit(0);
  }
  const platform404=live.res.status===404&&/<!DOCTYPE html>|<html/i.test(live.text)&&/cloudflare/i.test(live.text);
  platform404Count=platform404?platform404Count+1:0;
  if(platform404Count>=3)throw new Error('Cloudflare preview hostname is not serving the deployed Worker (platform HTML 404). Check temporary deployment URL extraction and deployment activation; this is not an application health route failure. URL='+base);
  last=`live status=${live.res.status} content-type=${live.res.headers.get('content-type')||'unknown'} body=${live.text.slice(0,240)}`;
 }catch(error){
  last=String(error);
  if(last.includes('Cloudflare preview hostname is not serving'))throw error;
 }
 await new Promise(resolve=>setTimeout(resolve,3000));
}
throw new Error('Cloudflare hosted preview did not become healthy: '+last);
