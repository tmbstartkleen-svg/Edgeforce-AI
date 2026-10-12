import {createHash} from 'node:crypto';
import type {D1Database} from './d1-observations';
type Env={CRON_SECRET?:unknown;INTELLIGENCE_DB?:unknown};
const headers={'Cache-Control':'no-store'};
export async function certifyD1Persistence(request:Request,env:Env):Promise<Response>{
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
 if(typeof env.CRON_SECRET!=='string'||!env.CRON_SECRET||
    request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 const db=env.INTELLIGENCE_DB as D1Database|undefined;
 if(!db||typeof db.prepare!=='function')
  return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 // The only permitted synthetic record is clearly identified as a non-betting certification.
 const token='certification-v1';
 const hash=createHash('sha256').update(token).digest('hex');
 try{
  const source='edgeforce-d1-certification';
  await db.prepare(`INSERT OR IGNORE INTO intelligence_sources(source_id,upstream_id,source_type,enabled)
    VALUES (?,?,?,0)`).bind(source,source,'CERTIFICATION_ONLY').run();
  const observedAt='2026-10-11T00:00:00.000Z';
  const eventId='schema-write-read-v1';
  const payload=JSON.stringify({certification:true,noSportsClaim:true});
  await db.prepare(`INSERT OR IGNORE INTO intelligence_observations
    (source_id,upstream_id,event_id,market_id,observation_kind,observed_at,payload_hash,payload)
    VALUES (?,?,?,?,?,?,?,?)`).bind(source,source,eventId,null,'result',observedAt,hash,payload).run();
  const found=await db.prepare(`SELECT source_id,upstream_id,event_id,payload_hash FROM intelligence_observations
     WHERE source_id=? AND event_id=? AND payload_hash=? LIMIT 1`).bind(source,eventId,hash).first<{source_id:string;upstream_id:string;event_id:string;payload_hash:string}>();
  const ok=Boolean(found&&found.source_id===source&&found.upstream_id===source&&found.payload_hash===hash);
  return Response.json({ok,mode:'SCHEMA_CERTIFICATION_ONLY',synthetic:true,sportsObservationsVerified:false},
    {status:ok?200:503,headers});
 }catch{
  return Response.json({ok:false,reason:'D1_PERSISTENCE_FAILED'},{status:503,headers});
 }
}
