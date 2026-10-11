import {db} from '@/lib/db';
import {authorizeNetwork,networkHeaders} from '@/lib/firstPartySportsNetwork';
import {normalizeLicensedPlays} from '@/lib/sportsOutcomeHistory';
export const dynamic='force-dynamic';
const fail=(status:string,code:number)=>Response.json({ok:false,status},{status:code,headers:networkHeaders});
/** Operator-submitted licensed observations, always source-declared and uncorroborated. */
export async function POST(request:Request){
 const auth=authorizeNetwork(request);if(auth)return auth;
 if(process.env.EDGEFORCE_PLAY_IMPORT_ENABLED!=='true')return fail('PLAY_IMPORT_DISABLED',503);
 const length=Number(request.headers.get('content-length')||0);
 if(length>24000)return fail('PAYLOAD_TOO_LARGE',413);
 let body:unknown;
 try{const text=await request.text();if(text.length>24000)throw Error('size');body=JSON.parse(text)}
 catch{return fail('INVALID_JSON',400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return fail('INVALID_IMPORT',400);
 const {source,plays}=body as Record<string,unknown>;
 if(typeof source!=='string'||!/^[A-Za-z0-9._-]{2,64}$/.test(source))return fail('INVALID_SOURCE',400);
 const allow=(process.env.EDGEFORCE_PLAY_ALLOWED_PROVIDERS||'').split(',').map(x=>x.trim());
 if(!allow.includes(source))return fail('SOURCE_RETENTION_NOT_AUTHORIZED',403);
 const records=normalizeLicensedPlays(plays,source);
 if(!records)return fail('INVALID_OR_AMBIGUOUS_PLAY_BATCH',400);
 const sql=db();if(!sql)return fail('DATABASE_NOT_CONFIGURED',503);
 try{
  // ONE PostgreSQL statement for a maximum of 30 validated plays.
  const inserted=await sql.begin(async tx=>{
   const rows=await tx`
    insert into public.edgeforce_sports_plays_v209(
     source,source_event_key,source_play_key,sport,observed_at,event_time,
     period_label,clock_label,description,player_name,team_name,raw_stats
    )
    select r.source,r."sourceEventKey",r."sourcePlayKey",r.sport,
     r."observedAt"::timestamptz,r."eventTime"::timestamptz,r."periodLabel",
     r."clockLabel",r.description,r."playerName",r."teamName",
     r."rawStats"
    from jsonb_to_recordset(${tx.json(records)}::jsonb)
     as r(source text,"sourceEventKey" text,"sourcePlayKey" text,sport text,
      "observedAt" text,"eventTime" text,"periodLabel" text,"clockLabel" text,
      description text,"playerName" text,"teamName" text,"rawStats" jsonb)
    where true on conflict(source,source_event_key,source_play_key) do nothing returning id`;
   return rows.length;
  });
  return Response.json({ok:true,network:'EdgeForce Sports Network',
   dataRole:'LICENSED_DECLARED_PLAY_HISTORY',requested:records.length,inserted,
   duplicateOrPreviouslyImported:records.length-inserted,independentlyVerified:false,
   warning:'This records operator-declared source observations. An API key is not proof of licensing or official game-event authenticity; source and retention rights must be verified separately.'},
  {headers:networkHeaders});
 }catch{return fail('PLAY_HISTORY_DATABASE_UNAVAILABLE',503)}
}
