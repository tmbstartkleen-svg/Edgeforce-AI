const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3000';
const count=Math.max(10,Number(process.env.LOAD_REQUESTS)||40);
const started=Date.now();
const durations=[];
let failures=0;

await Promise.all(Array.from({length:count},async(_,i)=>{
 const t=Date.now();
 try{
  const path=i%2===0?'/api/health':'/api/deployment/smoke';
  const res=await fetch(base+path,{cache:'no-store'});
  if(!res.ok)failures++;
 }catch{failures++}
 durations.push(Date.now()-t);
}));

durations.sort((a,b)=>a-b);
const percentile=p=>durations[Math.min(durations.length-1,Math.floor(durations.length*p))]||0;
const result={
 ok:failures===0,
 requests:count,
 failures,
 totalMs:Date.now()-started,
 p50Ms:percentile(.50),
 p95Ms:percentile(.95),
 maxMs:durations.at(-1)||0
};
console.log(JSON.stringify(result));
if(!result.ok)process.exit(1);
