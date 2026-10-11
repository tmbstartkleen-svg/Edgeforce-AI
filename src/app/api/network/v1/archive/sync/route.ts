import {authorizeNetwork,networkHeaders} from '@/lib/firstPartySportsNetwork';
import {ARCHIVE_KINDS,archiveAllowedSources,syncSportsArchive,type ArchiveKind} from '@/lib/sportsArchiveSync';
export const dynamic='force-dynamic';
const fail=(status:string,code:number)=>Response.json({ok:false,status},{status:code,headers:networkHeaders});
/** Manual, private, source-rights gated archive import. No source provider calls. */
export async function POST(request:Request){
 const auth=authorizeNetwork(request);if(auth)return auth;
 if(process.env.EDGEFORCE_ARCHIVE_WRITES_ENABLED!=='true')return fail('ARCHIVE_WRITES_DISABLED',503);
 const len=Number(request.headers.get('content-length')||0);
 if(len>300)return fail('PAYLOAD_TOO_LARGE',413);
 let body:unknown;
 try{const text=await request.text();if(text.length>300)throw Error('too large');body=JSON.parse(text)}
 catch{return fail('INVALID_JSON',400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return fail('INVALID_KIND',400);
 const kind=(body as Record<string,unknown>).kind;
 if(typeof kind!=='string'||!ARCHIVE_KINDS.includes(kind as ArchiveKind))return fail('INVALID_KIND',400);
 if(kind==='PLAYER_STAT'&&process.env.EDGEFORCE_ARCHIVE_PLAYER_STATS_ENABLED!=='true')return fail('PLAYER_ARCHIVE_DISABLED',403);
 const allowed=archiveAllowedSources(process.env.EDGEFORCE_ARCHIVE_ALLOWED_PROVIDERS);
 if(kind!=='MODEL_FORECAST'&&!allowed.length)return fail('ARCHIVE_SOURCE_RIGHTS_NOT_CONFIGURED',403);
 try{
  const snapshot=await syncSportsArchive(kind as ArchiveKind,allowed);
  return Response.json({ok:true,network:'EdgeForce Sports Network',version:'v208',
   dataRole:'PRIVATE_ARCHIVE_BACKFILL',boundedSourceRows:80,...snapshot,
   warning:'Imported only permitted records previously observed by EdgeForce. This did not request new scores or sportsbook prices.'},{headers:networkHeaders});
 }catch{
  return fail('ARCHIVE_DATABASE_OR_MIGRATION_UNAVAILABLE',503);
 }
}
