export const RETRYABLE_DEGRADED_HTTP=new Set([502,503,504]);

export function shouldRetryDegradedHttp(path,status,degradedAllowedPaths){
 return degradedAllowedPaths.has(path)&&RETRYABLE_DEGRADED_HTTP.has(Number(status));
}

export function parseSmokeJson(path,status,body){
 try{return JSON.parse(body)}
 catch{
  const preview=String(body||'').replace(/\s+/g,' ').slice(0,120);
  throw new Error(`${path} returned non-JSON HTTP ${status}${preview?`: ${preview}`:''}`);
 }
}
