import {NextRequest,NextResponse} from 'next/server';
import {clientKey,rateLimit} from '@/lib/rateLimit';
import {securityHeaders} from '@/lib/security';

export function proxy(req:NextRequest){
 const path=req.nextUrl.pathname;
 if(path.startsWith('/api/')){
  const result=rateLimit(clientKey(req.headers,path),180,60_000);
  if(!result.ok){
   return NextResponse.json(
    {ok:false,error:'rate limit exceeded'},
    {status:429,headers:{'Retry-After':String(Math.max(1,Math.ceil((result.resetAt-Date.now())/1000))),...securityHeaders}}
   );
  }
 }
 const res=NextResponse.next();
 for(const [k,v] of Object.entries(securityHeaders))res.headers.set(k,v);
 res.headers.set('x-edgeforce-request-id',crypto.randomUUID());
 return res;
}

export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
