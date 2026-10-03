import {NextRequest,NextResponse} from 'next/server';
import {clientKey,rateLimit} from '@/lib/rateLimit';
import {
 securityHeaders,MAX_MUTATION_BYTES,READ_API_RATE_LIMIT,WRITE_API_RATE_LIMIT
} from '@/lib/security';

const MUTATIONS=new Set(['POST','PUT','PATCH','DELETE']);
const BLOCKED_METHODS=new Set(['TRACE','TRACK','CONNECT']);

function securedJson(body:Record<string,unknown>,status:number,requestId:string,extra:Record<string,string>={}){
 return NextResponse.json(body,{
  status,
  headers:{...securityHeaders,'Cache-Control':'no-store','x-edgeforce-request-id':requestId,...extra}
 });
}

export function proxy(req:NextRequest){
 const path=req.nextUrl.pathname;
 const method=req.method.toUpperCase();
 const requestId=crypto.randomUUID();

 if(BLOCKED_METHODS.has(method)){
  return securedJson({ok:false,error:'method not allowed',requestId},405,requestId,{Allow:'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS'});
 }

 if(path.startsWith('/api/')){
  const mutating=MUTATIONS.has(method);
  if(mutating){
   const contentLength=Number(req.headers.get('content-length')||0);
   if(Number.isFinite(contentLength)&&contentLength>MAX_MUTATION_BYTES){
    return securedJson({ok:false,error:'request body too large',requestId},413,requestId);
   }
  }

  const limit=mutating?WRITE_API_RATE_LIMIT:READ_API_RATE_LIMIT;
  const result=rateLimit(clientKey(req.headers,path),limit,60_000);
  if(!result.ok){
   return securedJson(
    {ok:false,error:'rate limit exceeded',requestId},
    429,requestId,
    {'Retry-After':String(Math.max(1,Math.ceil((result.resetAt-Date.now())/1000)))}
   );
  }
 }

 const res=NextResponse.next();
 for(const [k,v] of Object.entries(securityHeaders))res.headers.set(k,v);
 res.headers.set('x-edgeforce-request-id',requestId);
 if(path.startsWith('/api/'))res.headers.set('Cache-Control','no-store');
 return res;
}

export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
