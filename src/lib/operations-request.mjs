// One request per panel; invalidation prevents late responses restoring locked data.
export function createOperationsRequestScope() {
 let active;
 return {
  reset() { active?.controller.abort(); clearTimeout(active?.timer); active=undefined; },
  begin(timeoutMs=15000) {
   this.reset();
   const request={controller:new AbortController(),timer:undefined};
   active=request;
   request.timer=setTimeout(()=>request.controller.abort(),timeoutMs);
   return {
    signal:request.controller.signal,
    isCurrent:()=>active===request,
    finish:()=>clearTimeout(request.timer),
   };
  },
 };
}
export async function readOperationsResponse(response) {
 if(response.status===401)throw Error('Operator token was not accepted. Unlock with an authorized token.');
 if(response.status===429)throw Error('Request limit reached. Pause refreshes and try again later.');
 if(response.status>=500)throw Error('The service is temporarily unavailable. Try again later.');
 let data;
 try{data=await response.json()}catch{throw Error('The service returned an unexpected response. Try again later.')}
 if(!response.ok||!data?.ok)throw Error('The requested operations data is unavailable. Try again later.');
 return data;
}
