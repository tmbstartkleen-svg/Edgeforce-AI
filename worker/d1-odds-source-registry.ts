/** Protected opt-in D1 source registry for independently licensed sportsbook collectors.
 * No credentials are accepted or returned. Disabled sources cannot ingest odds.
 */
type Database={prepare(sql:string):{bind(...values:unknown[]):{first<T>():Promise<T|null>;run():Promise<{meta?:{changes?:number}}>;all<T>():Promise<{results:T[]}>};all<T>():Promise<{results:T[]}>}};
type Env={CRON_SECRET?:unknown;INTELLIGENCE_DB?:unknown;ODDS_SOURCE_REGISTRY_WRITE_ENABLED?:unknown;ODDS_SOURCE_APPROVED_IDS?:unknown};
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers});
const identifier=(s:unknown)=>typeof s==='string'&&/^[A-Za-z0-9._:-]{3,100}$/.test(s);
const authentic=(req:Request,env:Env)=>typeof env.CRON_SECRET==='string'&&env.CRON_SECRET.length>=24&&req.headers.get('authorization')==='Bearer '+env.CRON_SECRET;
function approvedRegistry(env:Env){try{
 const ids=JSON.parse(String(env.ODDS_SOURCE_APPROVED_IDS||'[]'));
 return new Set<string>(Array.isArray(ids)?ids.filter(identifier).slice(0,100):[]);
 }catch{return new Set<string>()}}
export async function d1OddsSourceRegistry(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET'&&request.method!=='POST')return new Response(null,{status:405,headers:{...headers,Allow:'GET, POST'}});
 if(!authentic(request,env))return respond({ok:false,reason:'UNAUTHORIZED'},401);
 const database=env.INTELLIGENCE_DB as Database|undefined;
 if(!database?.prepare)return respond({ok:false,reason:'D1_BINDING_UNAVAILABLE'},503);
 const allow=approvedRegistry(env);
 if(request.method==='GET'){
  try{
   const result=await database.prepare(`SELECT source_id,upstream_id,source_type,enabled FROM intelligence_sources
     ORDER BY source_id LIMIT 200`).all<{source_id:string;upstream_id:string;source_type:string;enabled:number}>();
   return respond({ok:true,mode:'READ_ONLY_SOURCE_REGISTRY',sources:result.results.map(s=>({...s,eligibleForExplicitActivation:allow.has(s.source_id)})),
    writeEnabled:env.ODDS_SOURCE_REGISTRY_WRITE_ENABLED==='true',configuredApprovalCount:allow.size,
    sourceAuthenticityCertified:false,networkRequests:0,oddsCreditsSpent:0});
  }catch{return respond({ok:false,reason:'REGISTRY_READ_FAILED'},503)}
 }
 let input:unknown;try{input=await request.json()}catch{return respond({ok:false,reason:'INVALID_JSON'},400)}
 const data=input&&typeof input==='object'&&!Array.isArray(input)?input as Record<string,unknown>:{};
 const {sourceId,upstreamId,acknowledgeLicense,enableSource,confirm}=data;
 if(!identifier(sourceId)||!identifier(upstreamId)||typeof acknowledgeLicense!=='boolean'||
  (enableSource!==true&&enableSource!==false)||!['PREVIEW_ONLY','APPLY_REGISTERED_SOURCE'].includes(String(confirm)))
  return respond({ok:false,reason:'INVALID_SOURCE_REGISTRATION'},400);
 const source=sourceId as string,upstream=upstreamId as string;
 const approved=allow.has(source)&&acknowledgeLicense===true;
 const requestActivation=enableSource===true;
 const activeWrite=env.ODDS_SOURCE_REGISTRY_WRITE_ENABLED==='true';
 const permitted=approved&&activeWrite;
 const preview={sourceId:source,upstreamId:upstream,sourceType:'ODDS',requestedEnabled:requestActivation,
  isApprovedByEnvironment:allow.has(source),licenseAcknowledged:acknowledgeLicense,
  writeGateActive:activeWrite,willWrite:confirm==='APPLY_REGISTERED_SOURCE'&&permitted,
  requiresOperatorReview:true,providerRequests:0,oddsCreditsSpent:0};
 if(confirm==='PREVIEW_ONLY')return respond({ok:true,mode:'DRY_RUN',preview});
 if(!approved)return respond({ok:false,reason:'SOURCE_NOT_ALLOWLISTED_OR_LICENSE_NOT_ACKNOWLEDGED',preview},403);
 if(!activeWrite)return respond({ok:false,reason:'REGISTRY_WRITE_DISABLED',preview},503);
 // An established ID cannot be re-pointed at a different upstream operator.
 try{
  const existing=await database.prepare('SELECT upstream_id,source_type,enabled FROM intelligence_sources WHERE source_id=?')
   .bind(source).first<{upstream_id:string;source_type:string;enabled:number}>();
  if(existing&&(existing.upstream_id!==upstream||existing.source_type!=='ODDS'))
   return respond({ok:false,reason:'EXISTING_SOURCE_IDENTITY_CONFLICT',preview},409);
  if(existing){
   if(existing.enabled!==Number(requestActivation))return respond({ok:false,reason:'SOURCE_STATE_CHANGE_REQUIRES_SEPARATE_GOVERNED_APPROVAL',preview},409);
   return respond({ok:true,mode:'ALREADY_REGISTERED',sourceId:source,enabled:Boolean(existing.enabled),inserted:0,providerRequests:0,oddsCreditsSpent:0});
  }
  const written=await database.prepare(`INSERT OR IGNORE INTO intelligence_sources(source_id,upstream_id,source_type,enabled) VALUES(?,?,'ODDS',?)`)
   .bind(source,upstream,0).run();
  if(written.meta?.changes!==1)return respond({ok:false,reason:'SOURCE_INSERT_NOT_VERIFIED'},503);
  return respond({ok:true,mode:'REGISTERED_DISABLED',sourceId:source,enabled:false,inserted:1,
   nextStep:'Separate audit and explicit enablement required; no collector or API key has been activated.',
   providerRequests:0,oddsCreditsSpent:0});
 }catch{return respond({ok:false,reason:'REGISTRY_WRITE_FAILED',providerRequests:0},503)}
}
