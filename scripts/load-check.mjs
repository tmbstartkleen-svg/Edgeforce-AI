const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3000';
const count=Math.max(20,Number(process.env.LOAD_REQUESTS)||60);
const maxP95=Math.max(100,Number(process.env.LOAD_MAX_P95_MS)||3000);
const started=Date.now();
const durations=[];
let failures=0;

const paths=['/api/health/live','/api/health','/api/deployment/smoke'];

await Promise.all(Array.from({length:count},async(_,i)=>{
 const t=Date.now();
 try{
  const res=await fetch(base+paths[i%paths.length],{cache:'no-store'});
  if(!res.ok)failures++;
 }catch{failures++}
 durations.push(Date.now()-t);
}));

durations.sort((a,b)=>a-b);
const percentile=p=>durations[Math.min(durations.length-1,Math.floor((durations.length-1)*p))]||0;
const result={
 ok:failures===0&&percentile(.95)<=maxP95,
 requests:count,
 failures,
 totalMs:Date.now()-started,
 p50Ms:percentile(.50),
 p95Ms:percentile(.95),
 maxMs:durations.at(-1)||0,
 maxAllowedP95Ms:maxP95
};
console.log(JSON.stringify(result));
if(!result.ok)process.exit(1);
