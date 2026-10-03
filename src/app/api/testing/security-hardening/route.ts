import {
 securityHeaders,MAX_MUTATION_BYTES,READ_API_RATE_LIMIT,WRITE_API_RATE_LIMIT
} from '@/lib/security';

export const dynamic='force-dynamic';

export async function GET(){
 const required=[
  'X-Content-Type-Options','X-Frame-Options','Strict-Transport-Security',
  'Content-Security-Policy','Permissions-Policy','Cross-Origin-Opener-Policy'
 ] as const;
 const missing=required.filter(x=>!securityHeaders[x]);
 const csp=securityHeaders['Content-Security-Policy'];
 const ok=
  missing.length===0
  &&csp.includes("frame-ancestors 'none'")
  &&csp.includes("object-src 'none'")
  &&MAX_MUTATION_BYTES===1_048_576
  &&WRITE_API_RATE_LIMIT<READ_API_RATE_LIMIT;
 return Response.json({
  ok,missing,maxMutationBytes:MAX_MUTATION_BYTES,
  readRateLimit:READ_API_RATE_LIMIT,writeRateLimit:WRITE_API_RATE_LIMIT,
  csp,hsts:securityHeaders['Strict-Transport-Security']
 });
}
