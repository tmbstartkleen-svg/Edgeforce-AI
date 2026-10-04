const base=(process.env.SMOKE_BASE_URL||'').replace(/\/$/,'');
const expected=process.env.EXPECTED_APP_VERSION||'54.0.0';
if(!base)throw new Error('SMOKE_BASE_URL is required');

const paths=['/api/testing/trained-models','/api/intelligence/trained-models','/api/testing/expert-models','/api/intelligence/expert-models','/api/testing/live-comeback','/api/live-comeback','/api/intelligence/validation-lab','/api/intelligence/context','/api/parlays?size=2&view=today','/api/health/live','/api/health','/api/health/ready','/api/release/readiness','/api/deployment/smoke','/api/diagnostics','/api/ops/status','/'];
const results=[];

for(const path of paths){
 const started=Date.now();
 const res=await fetch(base+path,{redirect:'manual',headers:{'user-agent':'edgeforce-release-smoke/54'}});
 const body=await res.text();
 results.push({path,status:res.status,durationMs:Date.now()-started});
 if(!res.ok)throw new Error(path+' failed with '+res.status);
 if(path==='/api/testing/trained-models'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.assertions?.positiveSkill!==true||json.assertions?.promoted!==true)throw new Error('trained sport ML regression mismatch');
 }
 if(path==='/api/intelligence/trained-models'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V54'||json.schemaVersion!=='v54-trained-sport-ml-1')throw new Error('trained model status mismatch');
 }
 if(path==='/api/testing/expert-models'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.assertions?.councilIntegrated!==true)throw new Error('expert model regression mismatch');
 }
 if(path==='/api/intelligence/expert-models'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V54'||json.schemaVersion!=='v54-expert-models-1'||!Array.isArray(json.catalog))throw new Error('expert model API mismatch');
 }
 if(path==='/api/testing/live-comeback'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.assertions?.gameStateGuardrail!==true)throw new Error('live comeback regression mismatch');
 }
 if(path==='/api/live-comeback'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V52'||json.schemaVersion!=='v52-live-comeback-1'||json.gameStateVerified!==false)throw new Error('live comeback API mismatch');
 }
 if(path==='/api/intelligence/validation-lab'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V51'||!json.report?.overall)throw new Error('validation laboratory mismatch');
 }
 if(path==='/api/intelligence/context'){
  const json=JSON.parse(body);
  if(json.ok!==true||json.build!=='V51'||!json.diagnostics?.qualitySummary||!json.diagnostics?.publicNetwork)throw new Error('context intelligence mismatch');
 }
 if(path==='/api/parlays?size=2&view=today'){
  const json=JSON.parse(body);
  if(json.build!=='V51'||json.schemaVersion!=='v51-prediction-validation-1')throw new Error('parlay route schema mismatch');
  if(Number(json.thresholds?.recommendedMinJoint)!==0.52)throw new Error('parlay recommendation threshold mismatch');
  if(!Array.isArray(json.recommended)||!Array.isArray(json.valueWatchlist)||!Array.isArray(json.hailMary))throw new Error('parlay recommendation boards missing');
 }
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
