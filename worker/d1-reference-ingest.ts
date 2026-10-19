/** Explicitly gated, authenticated reference data ingest for D1 pilot only. */
type Env={INGEST_SECRET?:unknown;INTELLIGENCE_DB?:unknown;D1_REFERENCE_INGEST_ENABLED?:unknown};
type Stmt={bind(...args:unknown[]):{run():Promise<unknown>}};type Db={prepare(sql:string):Stmt};
type Entity={id:string;sport:string;league?:string|null;name?:string;full_name?:string;team_id?:string|null;city?:string|null;venue?:string|null;position?:string|null;home_team_id?:string|null;away_team_id?:string|null;start_time?:string;provider_event_id?:string|null;status?:string;source:string;observed_at:string};
const types=['teams','athletes','events'] as const;
function validId(v:unknown){return typeof v==='string'&&v.length>0&&v.length<=160&&/^[a-zA-Z0-9_.:-]+$/.test(v)}
function validText(v:unknown,max=200){return typeof v==='string'&&v.length>0&&v.length<=max}
function iso(v:unknown){return typeof v==='string'&&v.length>=20&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v}
function nullable(v:unknown){return v===undefined||v===null||validText(v)}
export async function d1ReferenceIngest(request:Request,env:Env):Promise<Response>{
 const headers={'Cache-Control':'no-store'};
 if(request.method!=='POST')return new Response(null,{status:405,headers:{...headers,Allow:'POST'}});
 if(!validText(env.INGEST_SECRET)||request.headers.get('authorization')!==`Bearer ${env.INGEST_SECRET}`)return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 if(env.D1_REFERENCE_INGEST_ENABLED!=='true')return Response.json({ok:false,reason:'PILOT_DISABLED'},{status:503,headers});
 const db=env.INTELLIGENCE_DB as Db|undefined;
 if(!db||typeof db.prepare!=='function')return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 let payload:unknown;
 try{payload=await request.json()}catch{return Response.json({ok:false,reason:'INVALID_JSON'},{status:400,headers})}
 if(!payload||typeof payload!=='object')return Response.json({ok:false,reason:'INVALID_PAYLOAD'},{status:400,headers});
 const {type,items} = payload as {type:unknown;items:unknown};
 if(!types.includes(type as typeof types[number])||!Array.isArray(items)||items.length===0||items.length>25)return Response.json({ok:false,reason:'INVALID_BATCH'},{status:400,headers});
 const values=items as Entity[];
 for(const e of values){
  if(!e||typeof e!=='object'||!validId(e.id)||!validText(e.sport)||!validText(e.source)||!iso(e.observed_at)||!nullable(e.league))return Response.json({ok:false,reason:'INVALID_SOURCE_OR_ID'},{status:400,headers});
  if(type==='teams'&&(!validText(e.name)||!nullable(e.city)||!nullable(e.venue)))return Response.json({ok:false,reason:'INVALID_TEAM'},{status:400,headers});
  if(type==='athletes'&&(!validText(e.full_name)||!nullable(e.team_id)||!nullable(e.position)))return Response.json({ok:false,reason:'INVALID_ATHLETE'},{status:400,headers});
  if(type==='events'&&(!iso(e.start_time)||!nullable(e.provider_event_id)||!nullable(e.home_team_id)||!nullable(e.away_team_id)||!nullable(e.status)))return Response.json({ok:false,reason:'INVALID_EVENT'},{status:400,headers});
 }
 try{
  let inserted=0;
  for(const e of values){
   const metadata=JSON.stringify({source:e.source,observed_at:e.observed_at});
   if(type==='teams')await db.prepare('INSERT OR IGNORE INTO teams(id,sport,league,name,city,venue,metadata) VALUES(?,?,?,?,?,?,?)').bind(e.id,e.sport,e.league??null,e.name,e.city??null,e.venue??null,metadata).run();
   else if(type==='athletes')await db.prepare('INSERT OR IGNORE INTO athletes(id,sport,league,full_name,team_id,position,metadata) VALUES(?,?,?,?,?,?,?)').bind(e.id,e.sport,e.league??null,e.full_name,e.team_id??null,e.position??null,metadata).run();
   else await db.prepare('INSERT OR IGNORE INTO events(id,provider_event_id,sport,league,home_team_id,away_team_id,start_time,venue,status,source,observed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(e.id,e.provider_event_id??null,e.sport,e.league??null,e.home_team_id??null,e.away_team_id??null,e.start_time,e.venue??null,e.status??'scheduled',e.source,e.observed_at).run();
   inserted++;
  }
  return Response.json({ok:true,kind:'D1_REFERENCE_PILOT_INGEST',type,processed:inserted,insertOnly:true,productionCutoverAuthorized:false},{headers});
 }catch{return Response.json({ok:false,reason:'D1_WRITE_FAILED',productionCutoverAuthorized:false},{status:503,headers})}
}
