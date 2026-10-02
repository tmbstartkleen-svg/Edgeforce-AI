const base=(process.env.SMOKE_BASE_URL||'').replace(/\/$/,'');
const expected=process.env.EXPECTED_APP_VERSION||'30.0.0';
if(!base)throw new Error('SMOKE_BASE_URL is required');

const paths=['/api/health/live','/api/health','/api/health/ready','/api/release/readiness','/api/deployment/smoke','/api/diagnostics','/api/ops/status','/'];
const results=[];

for(const path of paths){
 const started=Date.now();
 const res=await fetch(base+path,{redirect:'manual',headers:{'user-agent':'edgeforce-release-smoke/30'}});
 const body=await res.text();
 results.push({path,status:res.status,durationMs:Date.now()-started});
 if(!res.ok)throw new Error(path+' failed with '+res.status);
 if(path==='/api/health/live'||path==='/api/health'||path==='/api/deployment/smoke'||path==='/api/ops/status'){
  const json=JSON.parse(body);
  if(json.version!==expected)throw new Error(path+' version mismatch');
 }
 if(path==='/api/health'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.productionHardened!==true)throw new Error('health hardening mismatch');
 }
 if(path==='/api/health/ready'||path==='/api/release/readiness'){
  const json=JSON.parse(body);
  if(json.ready!==true)throw new Error(path+' not ready');
 }
 if(path==='/api/deployment/smoke'){
  const json=JSON.parse(body);
  if(json.smoke!==true)throw new Error('deployment smoke mismatch');
 }
}

console.log(JSON.stringify({ok:true,base,expected,results}));
