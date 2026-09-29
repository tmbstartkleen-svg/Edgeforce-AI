const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3000';

async function get(path){
 const res=await fetch(base+path,{redirect:'manual'});
 const text=await res.text();
 let body=null;
 try{body=JSON.parse(text)}catch{}
 return {res,body,text};
}

function assert(condition,message){
 if(!condition)throw new Error(message);
}

const health=await get('/api/health');
assert(health.res.ok,'health endpoint failed');
assert(health.body?.ok===true,'health payload not ok');
assert(health.body?.version==='17.0.0','unexpected health version');

const smoke=await get('/api/deployment/smoke');
assert(smoke.res.ok&&smoke.body?.smoke===true,'deployment smoke failed');

const diagnostics=await get('/api/diagnostics');
assert(diagnostics.res.ok&&diagnostics.body?.ok===true,'diagnostics failed');

const failure=await get('/api/testing/provider-failure');
assert(failure.res.ok,'provider failure simulation unavailable');
assert(failure.body?.selected==='secondary','provider health selection did not prefer healthy secondary');

const home=await get('/');
assert(home.res.ok,'dashboard failed');
assert(home.res.headers.get('x-content-type-options')==='nosniff','security header missing');
assert(home.res.headers.get('x-frame-options')==='DENY','frame protection missing');
assert(Boolean(home.res.headers.get('x-edgeforce-request-id')),'request id missing');

console.log(JSON.stringify({ok:true,base,checks:['health','smoke','diagnostics','provider-failure','dashboard-security']}));
