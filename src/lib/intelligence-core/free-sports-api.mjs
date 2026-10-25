import {timingSafeEqual} from 'node:crypto';
const resources=new Set(['sports','leagues','events','results','lines','teams']);
const filters={sports:['active'],leagues:['sport_id','active','north_american'],events:['league_key','north_american','status','date'],results:['league_key','north_american','event_id','completed','date'],lines:['league_key','north_american','event_id','date'],teams:['league_key','active']};
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...extra}});
function authenticated(request,token){
 const expected=Buffer.from('Bearer '+token),actual=Buffer.from(request.headers.get('authorization')||'');
 return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
function valid(key,value){
 if(['active','north_american','completed'].includes(key))return ['true','false'].includes(value);
 if(['sport_id','event_id'].includes(key))return /^[1-9]\d{0,14}$/.test(value);
 if(key==='league_key')return /^[a-z0-9_-]{1,100}$/.test(value);
 if(key==='status')return ['upcoming','live','completed'].includes(value);
 if(key==='date')return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 return false;
}
/** One instance per API key. Single-process gateway; not a distributed quota limiter. */
export function createFreeSportsApi({apiKey='',operatorToken='',fetchImpl=fetch,now=Date.now}={}){
 const cache=new Map();let nextRequestAt=0;
 return async function handle(request){
  if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405,{Allow:'GET'});
  if(operatorToken.length<24)return json({ok:false,error:'AUTH_NOT_CONFIGURED'},503);
  if(!authenticated(request,operatorToken))return json({ok:false,error:'UNAUTHORIZED'},401);
  const url=new URL(request.url),match=/^\/api\/sports\/v1\/([a-z]+)$/.exec(url.pathname),resource=match?.[1];
  if(resource==='coverage')return json({ok:true,provider:'betstack',configured:Boolean(apiKey.trim()),connectionVerified:false,resources:[...resources],coverage:'Discover actual sports and leagues using the authenticated upstream catalog; no all-sports guarantee.',oddsKind:'consensus',bookmakerExecutable:false,injuriesAvailable:false,simulationAvailable:false,externalRequests:0});
  if(!resources.has(resource))return json({ok:false,error:'NOT_FOUND'},404);
  for(const [key,value] of url.searchParams){
   if(!filters[resource].includes(key)||url.searchParams.getAll(key).length!==1||!valid(key,value))return json({ok:false,error:'INVALID_FILTER'},400);
  }
  if(!apiKey.trim())return json({ok:false,error:'BETSTACK_KEY_REQUIRED'},503);
  url.searchParams.sort();
  const upstream=new URL('https://api.betstack.dev/api/v1/'+resource);upstream.search=url.searchParams.toString();
  // Never allow sportsbook overrides to mislabel consensus as executable book prices.
  if(resource==='lines')upstream.searchParams.set('bookmaker_key','betstack');
  const key=upstream.href,time=now(),cached=cache.get(key);
  if(cached&&time-cached.receivedMs<60000)return json({...cached.body,cached:true});
  if(time<nextRequestAt)return json({ok:false,error:'FREE_TIER_COOLDOWN'},429,{'Retry-After':String(Math.ceil((nextRequestAt-time)/1000))});
  // Reserve before awaiting fetch so concurrent requests share the same per-key budget.
  nextRequestAt=time+60000;
  try{
   const response=await fetchImpl(upstream,{headers:{'X-API-Key':apiKey.trim(),Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});
   if(response.status===429){
    const retry=response.headers.get('retry-after');
    const seconds=Number(retry),date=Date.parse(retry||'');
    const delay=retry&&Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-now():60000;
    nextRequestAt=Math.max(nextRequestAt,now()+Math.max(60000,Math.min(86400000,delay)));
    return json({ok:false,error:'UPSTREAM_RATE_LIMITED'},429,{'Retry-After':String(Math.ceil((nextRequestAt-now())/1000))});
   }
   if(!response.ok)return json({ok:false,error:response.status===401?'UPSTREAM_AUTH_FAILED':'UPSTREAM_UNAVAILABLE'},502);
   if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Invalid content type');
   const reader=response.body?.getReader();if(!reader)throw new Error('Empty body');
   const chunks=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000){await reader.cancel();throw new Error('Too large')}chunks.push(value)}
   const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!Array.isArray(data))throw new Error('Expected collection');
   const receivedMs=now();
   const body={ok:true,provider:'betstack',resource,receivedAt:new Date(receivedMs).toISOString(),cached:false,data,oddsKind:resource==='lines'?'consensus':null,bookmakerExecutable:false,completeCoverageCertified:false,sourceTimestampsVerified:false};
   cache.delete(key);if(cache.size>=32)cache.delete(cache.keys().next().value);
   cache.set(key,{receivedMs,body});return json(body);
  }catch{return json({ok:false,error:'UPSTREAM_RESPONSE_INVALID_OR_UNAVAILABLE'},502)}
 };
}
