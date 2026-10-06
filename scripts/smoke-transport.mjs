import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';

const execute=promisify(execFile);
const footer='\n__EDGEFORCE_HTTP_STATUS__';
const transientCurlCodes=new Set([5,6,7,18,28,35,52,55,56,92]);
const transientNetworkCodes=new Set(['ECONNRESET','ECONNREFUSED','EAI_AGAIN','ETIMEDOUT','UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT']);

export function parseCurlResponse(stdout){
 const text=String(stdout);
 const boundary=text.lastIndexOf(footer);
 const code=boundary<0?'':text.slice(boundary+footer.length);
 if(!/^[2-5][0-9]{2}$/.test(code))throw new Error('Smoke transport did not return an unambiguous HTTP status');
 return {status:Number(code),body:text.slice(0,boundary)};
}

function retryable(error,vercelAuth){
 if(vercelAuth)return transientCurlCodes.has(error?.code)||error?.code==='ETIMEDOUT'||(error?.killed===true&&error?.signal==='SIGKILL'&&error?.code==null);
 return error?.name==='TimeoutError'||transientNetworkCodes.has(error?.code)||transientNetworkCodes.has(error?.cause?.code);
}

async function readBody(response,signal,maxBytes){
 if(!response.body)return '';
 const reader=response.body.getReader();
 const chunks=[];
 let size=0;
 // A real fetch aborts its stream, but race each read as well so a stalled
 // response body cannot evade the same deadline used for response headers.
 let rejectAbort;
 const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
 const onAbort=()=>rejectAbort(signal.reason);
 signal.addEventListener('abort',onAbort,{once:true});
 try{
  signal.throwIfAborted();
  while(true){
   const {done,value}=await Promise.race([reader.read(),aborted]);
   if(done)break;
   size+=value.byteLength;
   if(size>maxBytes)throw new Error('Smoke response exceeds the body size limit');
   chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
 }finally{
  signal.removeEventListener('abort',onAbort);
  // Do not await cancellation of a stalled upstream body.
  void reader.cancel().catch(()=>{});
  reader.releaseLock();
 }
}

/** GET-only release probes. Retry transport failures, never HTTP/schema failures. */
export function createSmokeFetch({
 base,vercelAuth=false,timeoutMs=30000,budgetMs=240000,maxAttempts=3,maxBytes=6*1024*1024,
 fetchImpl=globalThis.fetch,execImpl=execute,sleep=delay,now=Date.now,onRetry=()=>{}
}){
 const origin=new URL(base);
 if(!['https:','http:'].includes(origin.protocol)||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'){
  throw new Error('Smoke base must be a deployment origin without credentials');
 }
 for(const [name,value] of Object.entries({timeoutMs,budgetMs,maxAttempts,maxBytes})){
  if(!Number.isSafeInteger(value)||value<=0)throw new Error(`Invalid smoke transport option: ${name}`);
 }
 if(maxAttempts>3)throw new Error('Smoke transport permits at most three attempts');
 const deadline=now()+budgetMs;
 return async function smokeFetch(path){
  if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||path.includes('\\')||/[\r\n]/.test(path)){
   throw new Error('Smoke path must stay on the selected deployment');
  }
  const target=new URL(path,origin);
  if(target.origin!==origin.origin)throw new Error('Smoke path must stay on the selected deployment');
  for(let attempt=1;attempt<=maxAttempts;attempt++){
   const remaining=deadline-now();
   if(remaining<=0)throw new Error(`Smoke suite deadline exceeded at ${path}`);
   const attemptTimeout=Math.min(timeoutMs,remaining);
   try{
    let status,body;
    if(vercelAuth){
     const args=['curl',path,'--deployment',origin.origin,'--',
      '--silent','--show-error','--connect-timeout',String(Math.min(10000,attemptTimeout)/1000),
      '--max-time',String(attemptTimeout/1000),'--write-out',footer+'%{http_code}'];
     // stdout contains only body + status. CLI stderr is never parsed or
     // echoed (it may contain protection credentials in debug mode).
     const result=await execImpl('vercel',args,{
      encoding:'utf8',timeout:attemptTimeout,killSignal:'SIGKILL',maxBuffer:maxBytes+1024
     });
     ({status,body}=parseCurlResponse(result.stdout));
     if(Buffer.byteLength(body)>maxBytes)throw new Error('Smoke response exceeds the body size limit');
    }else{
     const signal=AbortSignal.timeout(attemptTimeout);
     const response=await fetchImpl(target.href,{
      redirect:'manual',signal,headers:{'user-agent':'edgeforce-release-smoke/119'}
     });
     status=response.status;
     body=await readBody(response,signal,maxBytes);
     if(!Number.isInteger(status)||status<200||status>599)throw new Error('Smoke transport returned an invalid HTTP status');
    }
    return {ok:status>=200&&status<300,status,text:async()=>body,attempts:attempt};
   }catch(error){
    const retry=retryable(error,vercelAuth)&&attempt<maxAttempts;
    const pause=Math.min(500*attempt,Math.max(0,deadline-now()));
    if(!retry||pause<=0)throw new Error(`Smoke transport failed at ${path} after ${attempt} attempt(s): ${retryable(error,vercelAuth)?'connection failure or timeout':'non-retryable transport failure'}`);
    onRetry({path,attempt,maxAttempts});
    await sleep(pause);
   }
  }
  throw new Error('Smoke transport exhausted its attempt limit');
 };
}
