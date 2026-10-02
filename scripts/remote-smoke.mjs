const base=(process.env.SMOKE_BASE_URL||'').replace(/\/$/,'');
if(!base)throw new Error('SMOKE_BASE_URL is required');

const paths=['/api/health','/api/deployment/smoke','/api/diagnostics','/api/release-readiness','/'];
const results=[];

for(const path of paths){
 const started=Date.now();
 const res=await fetch(base+path,{redirect:'manual',headers:{'user-agent':'edgeforce-release-smoke/29'}});
 const body=await res.text();
 results.push({path,status:res.status,durationMs:Date.now()-started});
 if(!res.ok)throw new Error(path+' failed with '+res.status);

 if(path==='/api/health'){
  const json=JSON.parse(body);
  if(json.version!=='29.0.0'||json.ok!==true)throw new Error('health version mismatch');
 }

 if(path==='/api/deployment/smoke'){
  const json=JSON.parse(body);
  if(json.smoke!==true||json.version!=='29.0.0')throw new Error('deployment smoke mismatch');
 }

 if(path==='/api/release-readiness'){
  const json=JSON.parse(body);
  if(json.readyForPreview!==true){
   throw new Error('release readiness blocked preview: '+(json.blockers||[]).join(' | '));
  }
  if(process.env.REQUIRE_PRODUCTION_READY==='true'&&json.readyForProduction!==true){
   throw new Error('release readiness blocked production: '+(json.warnings||[]).join(' | '));
  }
 }
}

console.log(JSON.stringify({ok:true,base,results,requireProductionReady:process.env.REQUIRE_PRODUCTION_READY==='true'}));
