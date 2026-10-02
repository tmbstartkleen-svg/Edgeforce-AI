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
assert(health.body?.version==='29.0.0','unexpected health version');
assert(health.body?.persistentWagerLedger===true,'persistent wager ledger flag missing');
assert(health.body?.automaticSettlement===true,'automatic settlement flag missing');
assert(health.body?.providerCircuitBreaker===true,'provider circuit breaker flag missing');
assert(health.body?.providerPayloadFreshnessGate===true,'payload freshness gate flag missing');
assert(health.body?.walkForwardCalibration===true,'walk-forward calibration flag missing');
assert(health.body?.controlledWeightPromotion===true,'controlled weight promotion flag missing');

const smoke=await get('/api/deployment/smoke');
assert(smoke.res.ok&&smoke.body?.smoke===true,'deployment smoke failed');

const diagnostics=await get('/api/diagnostics');
assert(diagnostics.res.ok&&diagnostics.body?.ok===true,'diagnostics failed');

const ledger=await get('/api/ledger/wagers');
assert(ledger.res.ok&&ledger.body?.ok===true,'ledger endpoint failed');
assert(ledger.body?.analytics?.overall?.net!==undefined,'ledger analytics missing');

const failure=await get('/api/testing/provider-failure');
assert(failure.res.ok,'provider failure simulation unavailable');
assert(failure.body?.selected==='secondary','provider circuit breaker did not skip quarantined primary');

const payloadQuality=await get('/api/testing/payload-quality');
assert(payloadQuality.res.ok&&payloadQuality.body?.ok===true,'payload quality gate simulation failed');
assert(payloadQuality.body?.fresh?.ok===true,'fresh payload was rejected');
assert(payloadQuality.body?.stale?.ok===false,'stale payload was not rejected');
assert(payloadQuality.body?.empty?.ok===false,'empty odds payload was not rejected');

const recalibration=await get('/api/testing/recalibration');
assert(recalibration.res.ok&&recalibration.body?.ok===true,'recalibration guardrail simulation failed');
assert(recalibration.body?.good?.promoted===true,'qualified model was not promoted');
assert(recalibration.body?.bad?.promoted===false,'poor holdout model was promoted');
assert(recalibration.body?.small?.promoted===false,'small-sample model was promoted');

const calibrationStatus=await get('/api/intelligence/calibration');
assert(calibrationStatus.res.ok,'calibration status endpoint failed');

const backtest=await get('/api/intelligence/backtest');
assert(backtest.res.ok,'walk-forward backtest endpoint failed');

const home=await get('/');
assert(home.res.ok,'dashboard failed');
assert(home.res.headers.get('x-content-type-options')==='nosniff','security header missing');
assert(home.res.headers.get('x-frame-options')==='DENY','frame protection missing');
assert(Boolean(home.res.headers.get('x-edgeforce-request-id')),'request id missing');

console.log(JSON.stringify({ok:true,base,checks:['health','smoke','diagnostics','ledger','provider-failure','payload-quality','recalibration','calibration-status','backtest','dashboard-security']}));
