export const MAX_MUTATION_BYTES=1_048_576;
export const READ_API_RATE_LIMIT=180;
export const WRITE_API_RATE_LIMIT=60;

export const securityHeaders={
 'X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Cross-Origin-Opener-Policy':'same-origin',
 'Cross-Origin-Resource-Policy':'same-site',
 'X-DNS-Prefetch-Control':'off',
 'X-Permitted-Cross-Domain-Policies':'none',
 'Origin-Agent-Cluster':'?1',
 'Strict-Transport-Security':'max-age=63072000; includeSubDomains; preload',
 'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
} as const;
