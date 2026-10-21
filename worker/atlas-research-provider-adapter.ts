// Build 410: private adapter for the existing Director request pipeline.
// A caller must separately supply an authenticated and quota-checked forwarder.
// This module has no route, timer, permissions, or automatic task activation.
export function createAtlasResearchProviderAdapter(
 forward:(request:Request)=>Promise<Response>,
 origin:string
):(question:string)=>Promise<{ok:true}|{ok:false;reason:string}>{
 return async question=>{
  if(typeof question!=='string'||question.trim().length<3||question.length>500)
   return {ok:false,reason:'INVALID_RESEARCH_QUESTION'};
  let url:URL;
  try{
   const base=new URL(origin);
   if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)
    return {ok:false,reason:'INVALID_ORIGIN'};
   url=new URL('/api/network/director',base);
  }catch{return {ok:false,reason:'INVALID_ORIGIN'};}
  // Reuse the actual Director research pipeline rather than a synthetic result.
  // Credentials and authorization are never accepted from scheduled-task payloads.
  const request=new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:question.trim()})});
  try{
   const response=await forward(request);
   if(!response.ok)return {ok:false,reason:'RESEARCH_UPSTREAM_FAILED'};
   const report=await response.json() as {ok?:unknown;question?:unknown};
   if(!report||report.ok!==true||report.question!==question.trim())
    return {ok:false,reason:'INVALID_DIRECTOR_REPORT'};
   return {ok:true};
  }catch{return {ok:false,reason:'RESEARCH_UPSTREAM_FAILED'};}
 };
}
