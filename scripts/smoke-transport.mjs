import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const STATUS_MARKER='\nEDGEFORCE_SMOKE_HTTP_STATUS:';
const RETRYABLE_CURL_CODES=new Set([5,6,7,18,28,35,52,55,56]);
const RETRYABLE_FETCH_CODES=new Set([
 'EAI_AGAIN','ECONNRESET','ECONNREFUSED','ETIMEDOUT','EPIPE',
 'UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET'
]);
const MAX_ATTEMPTS=3;

export function parseCurlResponse(stdout){
 const split=stdout.lastIndexOf(STATUS_MARKER);
 const statusText=split<0?'':stdout.slice(split+STATUS_MARKER.length).trim();
 if(!/^[2-5][0-9]{2}$/.test(statusText))throw new Error('Missing or invalid smoke HTTP status');
 const status=Number(statusText);
 const body=stdout.slice(0,split);
 return {ok:status>=200&&status<300,status,text:async()=>body};
}

// GET-only retries handle transport loss, not HTTP/auth/schema failures. Both
// transports return the actual HTTP status; callers retain all contract checks.
export function createSmokeFetch({
 base,vercelAuth=false,run=execFileSync,curlArgs=url=>['curl',url],fetchImpl=globalThis.fetch,sleep=delay,
 onRetry=event=>console.error(`[remote-smoke] retry ${event.path}: ${event.code} (attempt ${event.attempt}/${MAX_ATTEMPTS})`)
}){
 const origin=new URL(base);
 if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password)throw new Error('Invalid smoke base URL');
 return async function smokeFetch(path){
  if(!path.startsWith('/')||path.startsWith('//'))throw new Error('Smoke path must be relative to the selected deployment');
  const url=new URL(path,origin);
  if(url.origin!==origin.origin)throw new Error('Smoke path must remain on the selected deployment');
  for(let attempt=1;attempt<=MAX_ATTEMPTS;attempt++){
   let response;
   try{
    if(vercelAuth){
     const stdout=run('vercel',[
      ...curlArgs(url.href),
      '--silent','--show-error','--connect-timeout','10','--max-time','30',
      '--write-out',STATUS_MARKER+'%{http_code}'
     ],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:45000,maxBuffer:8*1024*1024});
     response=parseCurlResponse(stdout);
    }else{
     const result=await fetchImpl(url.href,{
      redirect:'manual',signal:AbortSignal.timeout(30000),
      headers:{'user-agent':'edgeforce-release-smoke/119'}
     });
     // Consume within the attempt so an interrupted response body is bounded too.
     const body=await result.text();
     response={ok:result.ok,status:result.status,text:async()=>body};
    }
   }catch(error){
    const code=vercelAuth?error?.status:(error?.cause?.code||error?.code||error?.name);
    const retryable=vercelAuth?RETRYABLE_CURL_CODES.has(code):
     (RETRYABLE_FETCH_CODES.has(code)||code==='TimeoutError');
    if(!retryable||attempt===MAX_ATTEMPTS){
     // Never expose child-process stdout/stderr: CLI diagnostics may contain
     // deployment-protection credentials. Keep error context to safe metadata.
     const reason=retryable?'transient transport failure exhausted retries':'non-retryable transport or status failure';
     throw new Error(`${path}: ${reason} after ${attempt} attempt(s)`);
    }
    onRetry({path,attempt,code});
    await sleep(250*2**(attempt-1));
    continue;
   }
   return {...response,attempts:attempt};
  }
  throw new Error('Smoke transport exhausted attempts');
 };
}
