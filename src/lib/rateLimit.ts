type Bucket={count:number;resetAt:number};
const buckets=new Map<string,Bucket>();

export function rateLimit(key:string,limit=120,windowMs=60_000){
 const now=Date.now();
 const current=buckets.get(key);
 if(!current||current.resetAt<=now){
  const next={count:1,resetAt:now+windowMs};
  buckets.set(key,next);
  return {ok:true,remaining:limit-1,resetAt:next.resetAt};
 }
 current.count++;
 const ok=current.count<=limit;
 return {ok,remaining:Math.max(0,limit-current.count),resetAt:current.resetAt};
}

export function clientKey(headers:Headers,path:string){
 const forwarded=headers.get('x-forwarded-for')?.split(',')[0]?.trim();
 return `${forwarded||'unknown'}:${path}`;
}
