import {db} from '@/lib/db';
import {authorizeNetwork,networkHeaders} from '@/lib/firstPartySportsNetwork';
import {evaluateEventIdentity,normalizedIdentity} from '@/lib/identityBacktesting';
export const dynamic='force-dynamic';
type LinkRow={id:string;entityType:string;canonicalId:string;source:string;sourceEntityId:string;reviewStatus:string;matchedAt:Date|string};
type EventRow={id:string;sport:string;league:string|null;home:string|null;away:string|null;startsAt:string|Date};
type ScoreRow={source:string;sourceEventKey:string;sport:string;league:string|null;home:string;away:string;startsAt:string|Date};
type CanonicalRow={id:string;label:string;sport:string;league:string|null};
const fail=(status:string,code:number)=>Response.json({ok:false,status},{status:code,headers:networkHeaders});
const isId=(x:unknown)=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{2,110}$/.test(x);
const isSource=(x:unknown)=>typeof x==='string'&&/^[a-zA-Z0-9._-]{2,64}$/.test(x);
export async function GET(request:Request){
 const auth=authorizeNetwork(request);if(auth)return auth;
 const sql=db();if(!sql)return fail('DATABASE_NOT_CONFIGURED',503);
 const kind=new URL(request.url).searchParams.get('type')||'EVENT';
 if(!['EVENT','TEAM','ATHLETE'].includes(kind))return fail('INVALID_ENTITY_TYPE',400);
 try{
  const rows=await sql<LinkRow[]>`
   select id::text as id,entity_type as "entityType",canonical_id as "canonicalId",
    source,source_entity_id as "sourceEntityId",review_status as "reviewStatus",
    matched_at as "matchedAt" from public.edgeforce_identity_links_v210
   where entity_type=${kind} order by id desc limit 70`;
  return Response.json({ok:true,entityType:kind,mappings:rows,liveTradingCertified:false,
   warning:'Manual source-identity mappings are not official league identities. Only strictly matched EVENT links can support outcome reconciliation when separate upstream provenance is reviewed.'},
  {headers:networkHeaders});
 }catch{return fail('IDENTITY_MIGRATION_OR_DATABASE_UNAVAILABLE',503);}
}
export async function POST(request:Request){
 const auth=authorizeNetwork(request);if(auth)return auth;
 if(process.env.EDGEFORCE_IDENTITY_REVIEW_ENABLED!=='true')return fail('IDENTITY_REVIEW_DISABLED',503);
 if(Number(request.headers.get('content-length')||0)>600)return fail('REQUEST_TOO_LARGE',413);
 let body:Record<string,unknown>;
 try{const text=await request.text();if(text.length>600)throw Error('too large');
  const obj=JSON.parse(text) as unknown;
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('bad');
  body=obj as Record<string,unknown>;
 }catch{return fail('INVALID_REQUEST',400);}
 const {type,canonicalId,source,sourceEntityId,sourceLabel}=body;
 if(!['EVENT','TEAM','ATHLETE'].includes(String(type))||!isId(canonicalId)||!isId(sourceEntityId)||!isSource(source))
  return fail('INVALID_IDENTITY_FIELDS',400);
 if((type==='TEAM'||type==='ATHLETE')&&
  (typeof sourceLabel!=='string'||sourceLabel.length>160||normalizedIdentity(sourceLabel).length<3))
  return fail('SOURCE_LABEL_REQUIRED',400);
 const sql=db();if(!sql)return fail('DATABASE_NOT_CONFIGURED',503);
 try{
  let status:'NAME_AND_TIME_MATCHED'|'SOURCE_OBSERVED'='SOURCE_OBSERVED';
  let evidence:Record<string,unknown>={};
  if(type==='EVENT'){
   const [canonical]=await sql<EventRow[]>`
    select e.id,e.sport,e.league,coalesce(t1.name,e.home_team_id) as home,
     coalesce(t2.name,e.away_team_id) as away,e.start_time as "startsAt"
    from events e left join teams t1 on t1.id=e.home_team_id
    left join teams t2 on t2.id=e.away_team_id
    where e.id=${canonicalId} limit 1`;
   const [score]=await sql<ScoreRow[]>`
    select source,source_event_key as "sourceEventKey",sport,league,
     home_name as home,away_name as away,scheduled_at as "startsAt"
    from public.edgeforce_sports_outcomes_v209 where source=${source} and source_event_key=${sourceEntityId}
    order by collected_at desc,id desc limit 1`;
   if(!canonical||!score)return fail('NO_MATCHING_CANONICAL_EVENT_OR_SOURCE_SCORE',404);
   const check=evaluateEventIdentity({
    sport:canonical.sport,league:canonical.league,home:canonical.home||'',away:canonical.away||'',
    startsAt:new Date(canonical.startsAt).toISOString(),outcomeSport:score.sport,outcomeLeague:score.league,
    outcomeHome:score.home,outcomeAway:score.away,outcomeAt:new Date(score.startsAt).toISOString()
   });
   if(!check.match)return Response.json({ok:false,status:'EVENT_IDENTITY_MISMATCH',reasons:check.reasons},
    {status:409,headers:networkHeaders});
   status='NAME_AND_TIME_MATCHED';
   evidence={method:check.method,sourceRecorded:true};
  }else{
   const rows=type==='TEAM'?await sql<CanonicalRow[]>`
    select id,name as label,sport,league from teams where id=${canonicalId} limit 1`:
    await sql<CanonicalRow[]>`select id,full_name as label,sport,league from athletes
     where id=${canonicalId} limit 1`;
   const entity=rows[0];
   if(!entity)return fail('CANONICAL_IDENTITY_NOT_FOUND',404);
   if(normalizedIdentity(entity.label)!==normalizedIdentity(sourceLabel))
    return fail('SOURCE_NAME_MISMATCH',409);
   // Declared alias only. No independent provider identity lookup is implied.
   evidence={sourceLabel,method:'EXACT_DECLARED_NAME_ONLY'};
  }
  const inserted=await sql<LinkRow[]>`
   insert into public.edgeforce_identity_links_v210(
    entity_type,canonical_id,source,source_entity_id,review_status,evidence)
   values(${type},${canonicalId},${source},${sourceEntityId},
    ${status},${sql.json(evidence)})
   on conflict(entity_type,source,source_entity_id) do nothing
   returning id::text as id,entity_type as "entityType",canonical_id as "canonicalId",
    source,source_entity_id as "sourceEntityId",review_status as "reviewStatus",
    matched_at as "matchedAt"`;
  if(!inserted.length)return fail('IDENTITY_ALREADY_BOUND_REVIEW_REQUIRED',409);
  return Response.json({ok:true,identity:inserted[0],sourceEvidence:evidence,
   warning:'Reviewed mapping does not certify an independent final score or licensed entity identity.'},
  {status:201,headers:networkHeaders});
 }catch{return fail('IDENTITY_DATABASE_UNAVAILABLE',503);}
}
